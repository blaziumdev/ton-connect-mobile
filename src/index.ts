/**
 * TON Connect Mobile SDK
 * Production-ready implementation using TON Connect v2 bridge protocol
 */

/// <reference path="./index.d.ts" />

import {
  TonConnectMobileConfig,
  ConnectionStatus,
  WalletInfo,
  SendTransactionRequest,
  StatusChangeCallback,
  PlatformAdapter,
  Network,
  TonConnectEventType,
  TonConnectEventListener,
  TransactionStatusResponse,
  BalanceResponse,
  PersistedSession,
} from './types';
import {
  buildConnectUniversalLink,
  buildReturnUniversalLink,
  buildSendTransactionRpcRequest,
  buildDisconnectRpcRequest,
  parseConnectResponse,
  parseRpcResponse,
  extractWalletInfoFromEvent,
  validateTransactionRequest,
} from './core/protocol';
import { SessionCrypto, hexToBytes, base64ToBytes, bytesToHex } from './core/session';
import { BridgeGateway, BridgeIncomingMessage } from './core/bridge';
import { ExpoAdapter } from './adapters/expo';
import { ReactNativeAdapter } from './adapters/react-native';
import { WebAdapter } from './adapters/web';
import { getWalletByName, getDefaultWallet, SUPPORTED_WALLETS, type WalletDefinition } from './core/wallets';

/**
 * Custom error classes
 */
export class TonConnectError extends Error {
  constructor(message: string, public code?: string, public recoverySuggestion?: string) {
    super(message);
    this.name = 'TonConnectError';
  }
}

export class ConnectionTimeoutError extends TonConnectError {
  constructor() {
    super(
      'Connection request timed out. The wallet did not respond in time.',
      'CONNECTION_TIMEOUT',
      'Make sure the wallet app is installed and try again.'
    );
    this.name = 'ConnectionTimeoutError';
  }
}

export class TransactionTimeoutError extends TonConnectError {
  constructor() {
    super(
      'Transaction request timed out.',
      'TRANSACTION_TIMEOUT',
      'Check the wallet app and try again.'
    );
    this.name = 'TransactionTimeoutError';
  }
}

export class UserRejectedError extends TonConnectError {
  constructor(message?: string) {
    super(message || 'User rejected the request', 'USER_REJECTED');
    this.name = 'UserRejectedError';
  }
}

export class ConnectionInProgressError extends TonConnectError {
  constructor() {
    super('Connection request already in progress', 'CONNECTION_IN_PROGRESS');
    this.name = 'ConnectionInProgressError';
  }
}

export class TransactionInProgressError extends TonConnectError {
  constructor() {
    super('Transaction request already in progress', 'TRANSACTION_IN_PROGRESS');
    this.name = 'TransactionInProgressError';
  }
}

/**
 * Main TON Connect Mobile SDK class
 * Implements the real TON Connect v2 bridge protocol
 */
export class TonConnectMobile {
  private adapter: PlatformAdapter;
  private config: Required<Omit<TonConnectMobileConfig, 'preferredWallet' | 'network' | 'tonApiEndpoint'>> & {
    preferredWallet?: string;
    network: Network;
    tonApiEndpoint?: string;
  };
  private statusChangeCallbacks: Set<StatusChangeCallback> = new Set();
  private eventListeners: Map<TonConnectEventType, Set<TonConnectEventListener>> = new Map();
  private currentStatus: ConnectionStatus = { connected: false, wallet: null };
  private currentWallet!: WalletDefinition;

  // TON Connect v2 protocol state
  private session: SessionCrypto | null = null;
  private bridge: BridgeGateway = new BridgeGateway();
  private walletBridgePublicKey: string | null = null; // hex wallet public key from bridge

  // Pending promises
  private connectionPromise: {
    resolve: (wallet: WalletInfo) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout> | null;
  } | null = null;

  private pendingRpcRequests: Map<number, {
    resolve: (result: string) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout> | null;
  }> = new Map();

  private rpcIdCounter: number = 1;

  constructor(config: TonConnectMobileConfig) {
    if (!config.manifestUrl) {
      throw new TonConnectError('manifestUrl is required');
    }
    if (!config.scheme) {
      throw new TonConnectError('scheme is required');
    }

    const network = config.network || 'mainnet';
    const defaultTonApiEndpoint =
      network === 'testnet'
        ? 'https://testnet.toncenter.com/api/v2'
        : 'https://toncenter.com/api/v2';

    this.config = {
      storageKeyPrefix: 'tonconnect_',
      connectionTimeout: 300000,
      transactionTimeout: 300000,
      skipCanOpenURLCheck: true,
      preferredWallet: config.preferredWallet,
      network,
      tonApiEndpoint: config.tonApiEndpoint || defaultTonApiEndpoint,
      ...config,
    } as any;

    // Determine wallet
    if (this.config.preferredWallet) {
      const wallet = getWalletByName(this.config.preferredWallet);
      this.currentWallet = wallet || getDefaultWallet();
    } else {
      this.currentWallet = getDefaultWallet();
    }

    console.log('[TON Connect] Initializing SDK v2 with wallet:', this.currentWallet.name);
    console.log('[TON Connect] Bridge URL:', this.currentWallet.bridgeUrl);

    // Initialize platform adapter
    this.adapter = this.createAdapter();

    // Load persisted session
    this.loadSession();
  }

  /**
   * Create platform adapter
   */
  private createAdapter(): PlatformAdapter {
    // eslint-disable-next-line no-undef
    if (typeof globalThis !== 'undefined' && (globalThis as any).window && (globalThis as any).document) {
      return new WebAdapter();
    }
    try {
      if (typeof require !== 'undefined') {
        const expoLinking = require('expo-linking');
        if (expoLinking) {
          return new ExpoAdapter();
        }
      }
    } catch {
      // Not Expo
    }
    return new ReactNativeAdapter();
  }

  /**
   * Handle incoming bridge message from wallet
   */
  private handleBridgeMessage(msg: BridgeIncomingMessage): void {
    if (!this.session) {
      console.error('[TON Connect] Received bridge message but no session');
      return;
    }

    try {
      // Decode base64 encrypted message
      const encryptedBytes = base64ToBytes(msg.message);
      const senderPublicKey = hexToBytes(msg.from);

      // Decrypt
      const decrypted = this.session.decrypt(encryptedBytes, senderPublicKey);
      console.log('[TON Connect] Decrypted bridge message');

      // Store wallet's bridge public key for future communication
      this.walletBridgePublicKey = msg.from;

      // Try to parse as connect response first
      const connectResult = parseConnectResponse(decrypted);
      if (connectResult) {
        if (connectResult.type === 'connect') {
          this.handleConnectSuccess(connectResult.data);
        } else if (connectResult.type === 'error') {
          this.handleConnectError(connectResult.data);
        }
        return;
      }

      // Try to parse as RPC response
      const rpcResult = parseRpcResponse(decrypted);
      if (rpcResult) {
        if (rpcResult.type === 'event' && rpcResult.event === 'disconnect') {
          this.handleRemoteDisconnect();
        } else if (rpcResult.type === 'result') {
          this.handleRpcResult(rpcResult.data);
        } else if (rpcResult.type === 'error') {
          this.handleRpcError(rpcResult.data);
        }
        return;
      }

      console.warn('[TON Connect] Unknown bridge message format');
    } catch (error) {
      console.error('[TON Connect] Error handling bridge message:', error);
    }
  }

  /**
   * Handle successful wallet connection
   */
  private handleConnectSuccess(event: any): void {
    try {
      const wallet = extractWalletInfoFromEvent(event);

      // Save session for persistence
      this.saveSession(wallet).catch((err) => {
        console.error('[TON Connect] Failed to save session:', err);
      });

      // Update status
      this.currentStatus = { connected: true, wallet };
      this.notifyStatusChange();
      this.emit('connect', wallet);

      // Resolve pending connection promise
      if (this.connectionPromise) {
        if (this.connectionPromise.timeout) {
          clearTimeout(this.connectionPromise.timeout);
        }
        const promise = this.connectionPromise;
        this.connectionPromise = null;
        promise.resolve(wallet);
      }
    } catch (error: any) {
      console.error('[TON Connect] Error processing connect response:', error);
      this.rejectConnection(new TonConnectError(error?.message || 'Invalid connect response'));
    }
  }

  /**
   * Handle connect error from wallet
   */
  private handleConnectError(event: any): void {
    const code = event.payload?.code;
    const message = event.payload?.message || 'Connection rejected';

    let error: Error;
    if (code === 300) {
      error = new UserRejectedError(message);
    } else {
      error = new TonConnectError(message, String(code));
    }

    this.rejectConnection(error);
  }

  /**
   * Handle remote disconnect from wallet
   */
  private handleRemoteDisconnect(): void {
    console.log('[TON Connect] Wallet disconnected remotely');
    this.currentStatus = { connected: false, wallet: null };
    this.clearSession().catch(() => {});
    this.notifyStatusChange();
    this.emit('disconnect', null);
  }

  /**
   * Handle RPC success result
   */
  private handleRpcResult(response: { result: string; id: number }): void {
    const pending = this.pendingRpcRequests.get(response.id);
    if (pending) {
      if (pending.timeout) clearTimeout(pending.timeout);
      this.pendingRpcRequests.delete(response.id);
      pending.resolve(response.result);
    }
  }

  /**
   * Handle RPC error result
   */
  private handleRpcError(response: { error: { code: number; message: string }; id: number }): void {
    const pending = this.pendingRpcRequests.get(response.id);
    if (pending) {
      if (pending.timeout) clearTimeout(pending.timeout);
      this.pendingRpcRequests.delete(response.id);

      let error: Error;
      if (response.error.code === 300) {
        error = new UserRejectedError(response.error.message);
      } else {
        error = new TonConnectError(response.error.message, String(response.error.code));
      }
      pending.reject(error);
    }
  }

  /**
   * Reject pending connection promise
   */
  private rejectConnection(error: Error): void {
    this.emit('error', error);
    if (this.connectionPromise) {
      if (this.connectionPromise.timeout) {
        clearTimeout(this.connectionPromise.timeout);
      }
      const promise = this.connectionPromise;
      this.connectionPromise = null;
      promise.reject(error);
    }
  }

  /**
   * Connect to wallet using TON Connect v2 bridge protocol
   */
  async connect(): Promise<WalletInfo> {
    // If already connected, return current wallet
    if (this.currentStatus.connected && this.currentStatus.wallet) {
      return this.currentStatus.wallet;
    }

    if (this.connectionPromise) {
      throw new ConnectionInProgressError();
    }

    console.log('[TON Connect] Starting connection to', this.currentWallet.name);

    // 1. Create new session (X25519 keypair)
    this.session = new SessionCrypto();
    console.log('[TON Connect] Session ID:', this.session.sessionId.substring(0, 16) + '...');

    // 2. Connect to bridge SSE
    this.bridge.close(); // Close any existing connection
    this.bridge.connect(
      this.currentWallet.bridgeUrl,
      this.session.sessionId,
      (msg) => this.handleBridgeMessage(msg),
      (error) => console.error('[TON Connect] Bridge error:', error)
    );
    console.log('[TON Connect] Bridge SSE connection initiated');

    // 3. Build universal link
    const universalLink = buildConnectUniversalLink(
      this.currentWallet.universalLink,
      this.session.sessionId,
      this.config.manifestUrl,
      'back'
    );
    console.log('[TON Connect] Universal link built');

    // 4. Return promise that resolves when wallet responds via bridge
    return new Promise<WalletInfo>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.connectionPromise) {
          this.connectionPromise = null;
          this.bridge.close();
          reject(new ConnectionTimeoutError());
        }
      }, this.config.connectionTimeout);

      this.connectionPromise = { resolve, reject, timeout };

      // 5. Open wallet app
      console.log('[TON Connect] Opening wallet app...');
      this.adapter.openURL(universalLink, this.config.skipCanOpenURLCheck).then((success) => {
        if (!success && this.connectionPromise) {
          this.connectionPromise = null;
          this.bridge.close();
          reject(new TonConnectError('Failed to open wallet app'));
        }
        console.log('[TON Connect] Wallet app opened, waiting for bridge response...');
      }).catch((error) => {
        if (this.connectionPromise) {
          if (this.connectionPromise.timeout) clearTimeout(this.connectionPromise.timeout);
          this.connectionPromise = null;
          this.bridge.close();
          reject(new TonConnectError(`Failed to open wallet: ${error?.message || String(error)}`));
        }
      });
    });
  }

  /**
   * Send transaction via TON Connect v2 bridge protocol
   */
  async sendTransaction(request: SendTransactionRequest): Promise<{ boc: string }> {
    const validation = validateTransactionRequest(request);
    if (!validation.valid) {
      throw new TonConnectError(validation.error || 'Invalid transaction request');
    }

    if (!this.currentStatus.connected || !this.currentStatus.wallet) {
      throw new TonConnectError('Not connected to wallet. Call connect() first.');
    }

    if (!this.session || !this.walletBridgePublicKey) {
      throw new TonConnectError('Session not established. Please reconnect.');
    }

    // Build JSON-RPC request
    const rpcId = this.rpcIdCounter++;
    const rpcRequest = buildSendTransactionRpcRequest(request, rpcId);

    // Encrypt and send via bridge
    const walletPubKeyBytes = hexToBytes(this.walletBridgePublicKey);
    const encrypted = this.session.encrypt(rpcRequest, walletPubKeyBytes);

    await this.bridge.send(
      this.currentWallet.bridgeUrl,
      this.session.sessionId,
      this.walletBridgePublicKey,
      encrypted
    );

    // Open wallet to foreground
    const returnLink = buildReturnUniversalLink(this.currentWallet.universalLink, 'back');
    this.adapter.openURL(returnLink, this.config.skipCanOpenURLCheck).catch(() => {
      // Non-critical — wallet may already be in foreground
    });

    // Wait for response via bridge
    return new Promise<{ boc: string }>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRpcRequests.delete(rpcId);
        reject(new TransactionTimeoutError());
      }, this.config.transactionTimeout);

      this.pendingRpcRequests.set(rpcId, {
        resolve: (result: string) => {
          this.emit('transaction', { boc: result });
          resolve({ boc: result });
        },
        reject: (error: Error) => {
          this.emit('error', error);
          reject(error);
        },
        timeout,
      });
    });
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    // Send disconnect event via bridge if connected
    if (this.session && this.walletBridgePublicKey) {
      try {
        const rpcId = this.rpcIdCounter++;
        const disconnectRequest = buildDisconnectRpcRequest(rpcId);
        const walletPubKeyBytes = hexToBytes(this.walletBridgePublicKey);
        const encrypted = this.session.encrypt(disconnectRequest, walletPubKeyBytes);
        await this.bridge.send(
          this.currentWallet.bridgeUrl,
          this.session.sessionId,
          this.walletBridgePublicKey,
          encrypted
        );
      } catch (error) {
        console.warn('[TON Connect] Failed to send disconnect to wallet:', error);
      }
    }

    // Close bridge
    this.bridge.close();

    // Clear session
    this.session = null;
    this.walletBridgePublicKey = null;
    await this.clearSession();

    // Update status
    this.currentStatus = { connected: false, wallet: null };
    this.notifyStatusChange();
    this.emit('disconnect', null);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.currentStatus };
  }

  /**
   * Get list of supported wallets
   */
  getSupportedWallets(): WalletDefinition[] {
    return SUPPORTED_WALLETS;
  }

  /**
   * Get current wallet being used
   */
  getCurrentWallet(): WalletDefinition {
    return this.currentWallet;
  }

  /**
   * Check if a wallet is available on the current platform
   */
  async isWalletAvailable(walletName?: string): Promise<boolean> {
    const wallet = walletName ? getWalletByName(walletName) : this.currentWallet;
    if (!wallet) return false;

    const isWeb = this.adapter.constructor.name === 'WebAdapter';
    if (isWeb) {
      return wallet.platforms.includes('web') || !!wallet.universalLink;
    }

    // eslint-disable-next-line no-undef
    const platform = typeof globalThis !== 'undefined' && (globalThis as any).Platform
      ? (globalThis as any).Platform.OS === 'ios' ? 'ios' : 'android'
      : 'android';

    return wallet.platforms.includes(platform);
  }

  /**
   * Set preferred wallet
   */
  setPreferredWallet(walletName: string): void {
    const wallet = getWalletByName(walletName);
    if (!wallet) {
      throw new TonConnectError(
        `Wallet "${walletName}" not found. Available: ${SUPPORTED_WALLETS.map((w) => w.name).join(', ')}`
      );
    }
    this.currentWallet = wallet;
    console.log('[TON Connect] Preferred wallet changed to:', wallet.name);
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusChangeCallbacks.delete(callback);
    };
  }

  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusChangeCallbacks.forEach((cb) => {
      try { cb(status); } catch { /* ignore */ }
    });
    this.emit('statusChange', status);
  }

  private emit<T>(event: TonConnectEventType, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try { listener(data); } catch { /* ignore */ }
      });
    }
  }

  on<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) listeners.delete(listener);
    };
  }

  off<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) listeners.delete(listener);
  }

  removeAllListeners(event?: TonConnectEventType): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.bridge.close();
    this.statusChangeCallbacks.clear();
    this.eventListeners.clear();
    this.connectionPromise = null;
    this.pendingRpcRequests.forEach((req) => {
      if (req.timeout) clearTimeout(req.timeout);
    });
    this.pendingRpcRequests.clear();
  }

  getNetwork(): Network {
    return this.config.network;
  }

  setNetwork(network: Network): void {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new TonConnectError('Network must be "mainnet" or "testnet"');
    }
    const oldNetwork = this.config.network;
    this.config.network = network;

    if (!this.config.tonApiEndpoint || this.config.tonApiEndpoint.includes(oldNetwork)) {
      this.config.tonApiEndpoint =
        network === 'testnet'
          ? 'https://testnet.toncenter.com/api/v2'
          : 'https://toncenter.com/api/v2';
    }
    this.notifyStatusChange();
  }

  /**
   * Get wallet balance
   */
  async getBalance(address?: string): Promise<BalanceResponse> {
    const targetAddress = address || this.currentStatus.wallet?.address;
    if (!targetAddress) {
      throw new TonConnectError('Address required. Connect a wallet or provide an address.');
    }

    const apiEndpoint = this.config.tonApiEndpoint ||
      (this.config.network === 'testnet'
        ? 'https://testnet.toncenter.com/api/v2'
        : 'https://toncenter.com/api/v2');

    const url = `${apiEndpoint}/getAddressInformation?address=${encodeURIComponent(targetAddress)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new TonConnectError(`Failed to fetch balance: ${response.status}`);
    }

    const data = await response.json();
    if (data.ok === false) {
      throw new TonConnectError(data.error || 'Failed to fetch balance');
    }

    const balance = data.result?.balance || '0';
    const balanceTon =
      (BigInt(balance) / BigInt(1000000000)).toString() +
      '.' +
      (BigInt(balance) % BigInt(1000000000)).toString().padStart(9, '0').replace(/0+$/, '');

    return {
      balance,
      balanceTon: balanceTon === '0.' ? '0' : balanceTon,
      network: this.config.network,
    };
  }

  /**
   * Get transaction status by hash
   */
  async getTransactionStatusByHash(txHash: string, address: string): Promise<TransactionStatusResponse> {
    if (!txHash) throw new TonConnectError('Transaction hash is required');
    if (!address) throw new TonConnectError('Address is required');

    const apiEndpoint = this.config.tonApiEndpoint ||
      (this.config.network === 'testnet'
        ? 'https://testnet.toncenter.com/api/v2'
        : 'https://toncenter.com/api/v2');

    const url = `${apiEndpoint}/getTransactions?address=${encodeURIComponent(address)}&limit=100`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new TonConnectError(`Failed to fetch transactions: ${response.status}`);
    }

    const data = await response.json();
    if (data.ok === false) {
      throw new TonConnectError(data.error || 'Failed to fetch transactions');
    }

    const transactions = data.result || [];
    const transaction = transactions.find((tx: any) =>
      tx.transaction_id?.hash === txHash ||
      tx.transaction_id?.lt === txHash
    );

    if (transaction) {
      return {
        status: 'confirmed',
        hash: transaction.transaction_id?.hash || txHash,
        blockNumber: transaction.transaction_id?.lt,
      };
    }

    return { status: 'pending', hash: txHash };
  }

  // ─── Session Persistence ───

  private async saveSession(wallet: WalletInfo): Promise<void> {
    if (!this.session || !this.walletBridgePublicKey) return;

    const sessionData: PersistedSession = {
      sessionSecretKey: bytesToHex(this.session.secretKey),
      walletPublicKey: this.walletBridgePublicKey,
      bridgeUrl: this.currentWallet.bridgeUrl,
      wallet,
    };

    const key = `${this.config.storageKeyPrefix}session_v2`;
    await this.adapter.setItem(key, JSON.stringify(sessionData));
  }

  private async loadSession(): Promise<void> {
    try {
      const key = `${this.config.storageKeyPrefix}session_v2`;
      const json = await this.adapter.getItem(key);
      if (!json) return;

      const data = JSON.parse(json) as PersistedSession;
      if (!data.sessionSecretKey || !data.walletPublicKey || !data.wallet) {
        await this.clearSession();
        return;
      }

      // Restore session
      this.session = SessionCrypto.fromState({ secretKey: data.sessionSecretKey });
      this.walletBridgePublicKey = data.walletPublicKey;

      // Reconnect to bridge
      this.bridge.connect(
        data.bridgeUrl,
        this.session.sessionId,
        (msg) => this.handleBridgeMessage(msg),
        (error) => console.error('[TON Connect] Bridge error:', error)
      );

      // Restore status
      this.currentStatus = { connected: true, wallet: data.wallet };
      this.notifyStatusChange();

      console.log('[TON Connect] Session restored for wallet:', data.wallet.name);
    } catch (error) {
      console.error('[TON Connect] Failed to load session:', error);
      await this.clearSession();
    }
  }

  private async clearSession(): Promise<void> {
    try {
      const key = `${this.config.storageKeyPrefix}session_v2`;
      await this.adapter.removeItem(key);
    } catch {
      // Ignore
    }
  }
}

// Export types
export * from './types';
export type { WalletDefinition } from './core/wallets';
export { SUPPORTED_WALLETS, getWalletByName, getDefaultWallet, getWalletsForPlatform } from './core/wallets';

// Export utilities
export * from './utils/transactionBuilder';
export * from './utils/retry';
