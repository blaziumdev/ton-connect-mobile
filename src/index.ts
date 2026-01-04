/**
 * TON Connect Mobile SDK
 * Production-ready implementation for React Native and Expo
 */

// Type declarations for runtime globals (imported from index.d.ts via reference)
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
  TransactionStatus,
  TransactionStatusResponse,
  BalanceResponse,
} from './types';
import {
  buildConnectionRequest,
  buildTransactionRequest,
  parseCallbackURL,
  extractWalletInfo,
  validateConnectionResponse,
  validateTransactionRequest,
  validateTransactionResponse,
  decodeBase64URL,
} from './core/protocol';
import type {
  ConnectionResponsePayload,
  TransactionResponsePayload,
  ErrorResponse,
  ConnectionRequestPayload,
} from './types';
import { verifyConnectionProof, generateSessionId } from './core/crypto';
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
      'Please make sure the wallet app is installed and try again. If the issue persists, check your internet connection.'
    );
    this.name = 'ConnectionTimeoutError';
  }
}

export class TransactionTimeoutError extends TonConnectError {
  constructor() {
    super(
      'Transaction request timed out. The wallet did not respond in time.',
      'TRANSACTION_TIMEOUT',
      'Please check the wallet app and try again. Make sure you approve or reject the transaction in the wallet.'
    );
    this.name = 'TransactionTimeoutError';
  }
}

export class UserRejectedError extends TonConnectError {
  constructor(message?: string) {
    super(
      message || 'User rejected the request',
      'USER_REJECTED',
      'The user cancelled the operation in the wallet app.'
    );
    this.name = 'UserRejectedError';
  }
}

export class ConnectionInProgressError extends TonConnectError {
  constructor() {
    super(
      'Connection request already in progress',
      'CONNECTION_IN_PROGRESS',
      'Please wait for the current connection attempt to complete before trying again.'
    );
    this.name = 'ConnectionInProgressError';
  }
}

export class TransactionInProgressError extends TonConnectError {
  constructor() {
    super(
      'Transaction request already in progress',
      'TRANSACTION_IN_PROGRESS',
      'Please wait for the current transaction to complete before sending another one.'
    );
    this.name = 'TransactionInProgressError';
  }
}

/**
 * Main TON Connect Mobile SDK class
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
  private urlUnsubscribe: (() => void) | null = null;
  private currentWallet!: WalletDefinition;
  private connectionPromise: {
    resolve: (wallet: WalletInfo) => void;
    reject: (error: Error) => void;
    timeout: number | null;
  } | null = null;
  private transactionPromise: {
    resolve: (response: { boc: string; signature: string }) => void;
    reject: (error: Error) => void;
    timeout: number | null;
  } | null = null;
  private signDataPromise: {
    resolve: (response: { signature: string; timestamp: number }) => void;
    reject: (error: Error) => void;
    timeout: number | null;
  } | null = null;

  constructor(config: TonConnectMobileConfig) {
    // Validate config
    if (!config.manifestUrl) {
      throw new TonConnectError('manifestUrl is required');
    }
    if (!config.scheme) {
      throw new TonConnectError('scheme is required');
    }

    // Validate network
    const network = config.network || 'mainnet';
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new TonConnectError('Network must be either "mainnet" or "testnet"');
    }

    // Set default TON API endpoint based on network
    const defaultTonApiEndpoint =
      network === 'testnet'
        ? 'https://testnet.toncenter.com/api/v2'
        : 'https://toncenter.com/api/v2';

    this.config = {
      storageKeyPrefix: 'tonconnect_',
      connectionTimeout: 300000, // 5 minutes
      transactionTimeout: 300000, // 5 minutes
      skipCanOpenURLCheck: true, // Skip canOpenURL check by default (Android issue)
      preferredWallet: config.preferredWallet,
      network,
      tonApiEndpoint: config.tonApiEndpoint || defaultTonApiEndpoint,
      ...config,
    } as Required<Omit<TonConnectMobileConfig, 'preferredWallet' | 'network' | 'tonApiEndpoint'>> & {
      preferredWallet?: string;
      network: Network;
      tonApiEndpoint?: string;
    };

    // Determine which wallet to use
    if (this.config.preferredWallet) {
      const wallet = getWalletByName(this.config.preferredWallet);
      if (wallet) {
        this.currentWallet = wallet;
        console.log('[TON Connect] Using preferred wallet:', wallet.name);
      } else {
        console.warn('[TON Connect] Preferred wallet not found, using default');
        this.currentWallet = getDefaultWallet();
      }
    } else {
      this.currentWallet = getDefaultWallet();
    }

    console.log('[TON Connect] Initializing SDK with config:', {
      manifestUrl: this.config.manifestUrl,
      scheme: this.config.scheme,
      network: this.config.network,
      wallet: this.currentWallet.name,
      universalLink: this.currentWallet.universalLink,
    });

    // Initialize platform adapter
    this.adapter = this.createAdapter();
    console.log('[TON Connect] Adapter initialized:', this.adapter.constructor.name);

    // Set up URL listener
    this.setupURLListener();

    // Load persisted session
    this.loadSession();
  }

  /**
   * Create platform adapter based on available modules
   */
  private createAdapter(): PlatformAdapter {
    // Check if we're in a web environment
    // eslint-disable-next-line no-undef
    if (typeof globalThis !== 'undefined' && (globalThis as any).window && (globalThis as any).document) {
      // Web platform
      console.log('[TON Connect] Using WebAdapter');
      return new WebAdapter();
    }

    // Try to detect Expo environment
    try {
      // Check if expo-linking is available
      if (typeof require !== 'undefined') {
        const expoLinking = require('expo-linking');
        if (expoLinking) {
          console.log('[TON Connect] Using ExpoAdapter');
          return new ExpoAdapter();
        }
      }
    } catch (error) {
      console.log('[TON Connect] ExpoAdapter not available:', error);
      // expo-linking not available, continue to React Native adapter
    }

    // Fall back to React Native adapter
    // This will work for both React Native CLI and Expo (since Expo also has react-native)
    console.log('[TON Connect] Using ReactNativeAdapter');
    return new ReactNativeAdapter();
  }

  /**
   * Set up URL listener for wallet callbacks
   */
  private setupURLListener(): void {
    console.log('[TON Connect] Setting up URL listener...');
    this.urlUnsubscribe = this.adapter.addURLListener((url) => {
      console.log('[TON Connect] URL callback received:', url);
      this.handleCallback(url);
    });

    // Also check initial URL (when app was opened via deep link)
    this.adapter.getInitialURL().then((url) => {
      if (url) {
        console.log('[TON Connect] Initial URL found:', url);
        this.handleCallback(url);
      } else {
        console.log('[TON Connect] No initial URL');
      }
    });
  }

  /**
   * Handle callback from wallet
   */
  private handleCallback(url: string): void {
    console.log('[TON Connect] handleCallback called with URL:', url);
    console.log('[TON Connect] Expected scheme:', this.config.scheme);
    console.log('[TON Connect] URL starts with scheme?', url?.startsWith(`${this.config.scheme}://`));
    
    // CRITICAL FIX: Check if URL matches our scheme
    if (!url || typeof url !== 'string') {
      console.log('[TON Connect] Invalid URL, ignoring:', url);
      return;
    }
    
    if (!url.startsWith(`${this.config.scheme}://`)) {
      console.log('[TON Connect] Callback URL does not match scheme, ignoring:', url);
      console.log('[TON Connect] Expected prefix:', `${this.config.scheme}://`);
      return;
    }
    
    const parsed = parseCallbackURL(url, this.config.scheme);
    console.log('[TON Connect] Parsed callback:', parsed.type, parsed.data ? 'has data' : 'no data');

    // CRITICAL FIX: Check for sign data response first (before other handlers)
    // Note: We check if promise exists and hasn't timed out (timeout !== null means not timed out yet)
    if (this.signDataPromise && this.signDataPromise.timeout !== null) {
      // Sign data request is pending and hasn't timed out
      if (parsed.type === 'error' && parsed.data) {
        const errorData = parsed.data as ErrorResponse;
        if (errorData?.error) {
          const promise = this.signDataPromise;
          this.signDataPromise = null;
          if (errorData.error.code === 300) {
            promise.reject(new UserRejectedError());
          } else {
            promise.reject(new TonConnectError(errorData.error.message || 'Sign data failed'));
          }
          return;
        }
      }

      // Check for sign data response format
      // Note: TON Connect protocol may return sign data in different format
      // We check for signature field in the response
      if (parsed.data && typeof parsed.data === 'object') {
        const data = parsed.data as any;
        if (data.signature && typeof data.signature === 'string') {
          const promise = this.signDataPromise;
          this.signDataPromise = null;
          promise.resolve({
            signature: data.signature,
            timestamp: data.timestamp || Date.now(),
          });
          return;
        }
      }
    }

    // Handle connection responses
    if (parsed.type === 'connect' && parsed.data) {
      this.handleConnectionResponse(parsed.data as ConnectionResponsePayload);
    } else if (parsed.type === 'transaction' && parsed.data) {
      this.handleTransactionResponse(parsed.data as TransactionResponsePayload);
    } else if (parsed.type === 'error' && parsed.data) {
      const errorData = parsed.data as ErrorResponse;
      if (errorData?.error) {
        if (errorData.error.code === 300 || errorData.error.message?.toLowerCase().includes('reject')) {
          this.rejectWithError(new UserRejectedError());
        } else {
          this.rejectWithError(
            new TonConnectError(errorData.error.message || 'Unknown error', String(errorData.error.code))
          );
        }
      }
    }
  }

  /**
   * Handle connection response from wallet
   */
  private handleConnectionResponse(response: ConnectionResponsePayload): void {
    if (!validateConnectionResponse(response)) {
      this.rejectWithError(new TonConnectError('Invalid connection response'));
      return;
    }

    // Verify proof if present
    if (response.proof) {
      const isValid = verifyConnectionProof(response, this.config.manifestUrl);
      if (!isValid) {
        this.rejectWithError(new TonConnectError('Connection proof verification failed'));
        return;
      }
    } else {
      // Log warning if proof is missing (security consideration)
      console.warn('TON Connect: Connection proof missing - wallet may not support proof verification');
    }

    const wallet = extractWalletInfo(response);

    // Validate session ID before saving
    if (!this.validateSessionId(response.session)) {
      this.rejectWithError(new TonConnectError('Invalid session ID format'));
      return;
    }

    // Save session
    this.saveSession(response.session, wallet).catch((error) => {
      console.error('TON Connect: Failed to save session:', error);
      // Continue anyway - connection is still valid
    });

    // Update status
    this.currentStatus = { connected: true, wallet };
    this.notifyStatusChange();

    // Emit connect event
    this.emit('connect', wallet);

    // Resolve connection promise
    // CRITICAL: Only resolve if promise still exists and hasn't timed out
    if (this.connectionPromise) {
      // Clear timeout if it exists
      if (this.connectionPromise.timeout !== null) {
        clearTimeout(this.connectionPromise.timeout);
      }
      // Store reference before clearing to prevent race conditions
      const promise = this.connectionPromise;
      // Clear promise first
      this.connectionPromise = null;
      // Then resolve
      promise.resolve(wallet);
    }
  }

  /**
   * Handle transaction response from wallet
   */
  private handleTransactionResponse(response: TransactionResponsePayload): void {
    if (!validateTransactionResponse(response)) {
      this.rejectWithError(new TonConnectError('Invalid transaction response'));
      return;
    }

    const transactionResult = {
      boc: response.boc,
      signature: response.signature,
    };

    // Emit transaction event
    this.emit('transaction', transactionResult);

    // Resolve transaction promise
    // CRITICAL: Only resolve if promise still exists and hasn't timed out
    if (this.transactionPromise) {
      // Clear timeout if it exists
      if (this.transactionPromise.timeout !== null) {
        clearTimeout(this.transactionPromise.timeout);
      }
      // Store reference before clearing
      const promise = this.transactionPromise;
      // Clear promise first to prevent race conditions
      this.transactionPromise = null;
      // Then resolve
      promise.resolve(transactionResult);
    }
  }

  /**
   * Reject current promise with error
   */
  private rejectWithError(error: Error): void {
    // Emit error event
    this.emit('error', error);

    if (this.connectionPromise) {
      if (this.connectionPromise.timeout !== null) {
        clearTimeout(this.connectionPromise.timeout);
      }
      this.connectionPromise.reject(error);
      this.connectionPromise = null;
    }
    if (this.transactionPromise) {
      if (this.transactionPromise.timeout !== null) {
        clearTimeout(this.transactionPromise.timeout);
      }
      this.transactionPromise.reject(error);
      this.transactionPromise = null;
    }
    // CRITICAL FIX: Also clear signDataPromise to prevent memory leaks
    if (this.signDataPromise) {
      if (this.signDataPromise.timeout !== null) {
        clearTimeout(this.signDataPromise.timeout);
      }
      this.signDataPromise.reject(error);
      this.signDataPromise = null;
    }
  }

  /**
   * Connect to wallet
   */
  async connect(): Promise<WalletInfo> {
    console.log('[TON Connect] connect() called');
    
    // If already connected, return current wallet
    if (this.currentStatus.connected && this.currentStatus.wallet) {
      console.log('[TON Connect] Already connected, returning existing wallet');
      return this.currentStatus.wallet;
    }

    // CRITICAL FIX: Check if connection is already in progress
    if (this.connectionPromise) {
      console.log('[TON Connect] Connection already in progress');
      throw new ConnectionInProgressError();
    }

    // Build connection request URL (use wallet's universal link)
    console.log('[TON Connect] Building connection request URL for wallet:', this.currentWallet.name);
    console.log('[TON Connect] Using universal link:', this.currentWallet.universalLink);
    console.log('[TON Connect] Wallet return strategy:', this.currentWallet.preferredReturnStrategy || 'back');
    console.log('[TON Connect] Wallet requires returnScheme:', this.currentWallet.requiresReturnScheme !== false);
    
    const url = buildConnectionRequest(
      this.config.manifestUrl,
      this.config.scheme,
      this.currentWallet.universalLink,
      this.currentWallet.preferredReturnStrategy,
      this.currentWallet.requiresReturnScheme
    );
    
    // DEBUG: Decode and log the payload for debugging
    try {
      const urlParts = url.split('?');
      if (urlParts.length > 1) {
        const payload = urlParts[1];
        // CRITICAL FIX: Handle URL encoding - payload might have additional encoding
        const cleanPayload = decodeURIComponent(payload);
        const decoded = decodeBase64URL<ConnectionRequestPayload>(cleanPayload);
        console.log('[TON Connect] Connection request payload:', JSON.stringify(decoded, null, 2));
      }
    } catch (e: any) {
      // Log decode errors for debugging but don't fail
      console.log('[TON Connect] Could not decode payload for logging:', e?.message || e);
      // This is just for logging, the actual URL is correct
    }
    
    console.log('[TON Connect] Built URL:', url.substring(0, 100) + '...');
    console.log('[TON Connect] Full URL:', url);
    console.log('[TON Connect] Manifest URL:', this.config.manifestUrl);
    console.log('[TON Connect] Return scheme:', this.config.scheme);
    console.log('[TON Connect] Adapter type:', this.adapter.constructor.name);

    // Create promise for connection
    return new Promise<WalletInfo>((resolve, reject) => {
      let timeout: number | null = null;

      this.connectionPromise = {
        resolve: (wallet: WalletInfo) => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
          this.connectionPromise = null;
          resolve(wallet);
        },
        reject: (error: Error) => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
          this.connectionPromise = null;
          reject(error);
        },
        timeout: null,
      };

      // Set timeout
      timeout = setTimeout(() => {
        if (this.connectionPromise) {
          console.log('[TON Connect] Connection timeout after', this.config.connectionTimeout, 'ms');
          this.connectionPromise.reject(new ConnectionTimeoutError());
        }
      }, this.config.connectionTimeout) as unknown as number;

      this.connectionPromise.timeout = timeout;

      // Open wallet app
      console.log('[TON Connect] Attempting to open wallet app...');
      this.adapter.openURL(url, this.config.skipCanOpenURLCheck).then((success) => {
        console.log('[TON Connect] openURL result:', success);
        // URL opened successfully, wait for callback
        // If success is false, it should have thrown an error
        if (!success && this.connectionPromise) {
          console.log('[TON Connect] openURL returned false, rejecting promise');
          this.connectionPromise.reject(
            new TonConnectError('Failed to open wallet app. Please make sure a TON wallet is installed.')
          );
        } else {
          console.log('[TON Connect] URL opened successfully, waiting for wallet callback...');
        }
      }).catch((error) => {
        // Error opening URL - reject the promise
        console.error('[TON Connect] Error opening URL:', error);
        if (this.connectionPromise) {
          this.connectionPromise.reject(
            new TonConnectError(`Failed to open wallet: ${error?.message || String(error)}`)
          );
        }
      });
    });
  }

  /**
   * Send transaction
   */
  async sendTransaction(request: SendTransactionRequest): Promise<{ boc: string; signature: string }> {
    // Validate request
    const validation = validateTransactionRequest(request);
    if (!validation.valid) {
      throw new TonConnectError(validation.error || 'Invalid transaction request');
    }

    // Check if connected
    if (!this.currentStatus.connected || !this.currentStatus.wallet) {
      throw new TonConnectError('Not connected to wallet. Call connect() first.');
    }

    // CRITICAL FIX: Check if transaction is already in progress
    if (this.transactionPromise) {
      throw new TransactionInProgressError();
    }

    // Build transaction request URL (use universal link for Android compatibility)
    const url = buildTransactionRequest(
      this.config.manifestUrl,
      request,
      this.config.scheme,
      this.currentWallet.universalLink,
      this.currentWallet.preferredReturnStrategy,
      this.currentWallet.requiresReturnScheme
    );

    // Create promise for transaction
    return new Promise<{ boc: string; signature: string }>((resolve, reject) => {
      let timeout: number | null = null;

      this.transactionPromise = {
        resolve: (response: { boc: string; signature: string }) => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
          this.transactionPromise = null;
          resolve(response);
        },
        reject: (error: Error) => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
          this.transactionPromise = null;
          reject(error);
        },
        timeout: null,
      };

      // Set timeout
      timeout = setTimeout(() => {
        if (this.transactionPromise) {
          this.transactionPromise.reject(new TransactionTimeoutError());
        }
      }, this.config.transactionTimeout) as unknown as number;

      this.transactionPromise.timeout = timeout;

      // Open wallet app
      this.adapter.openURL(url, this.config.skipCanOpenURLCheck).then((success) => {
        // URL opened successfully, wait for callback
        // If success is false, it should have thrown an error
        if (!success && this.transactionPromise) {
          this.transactionPromise.reject(
            new TonConnectError('Failed to open wallet app. Please make sure a TON wallet is installed.')
          );
        }
      }).catch((error) => {
        // Error opening URL - reject the promise
        if (this.transactionPromise) {
          this.transactionPromise.reject(
            new TonConnectError(`Failed to open wallet: ${error?.message || String(error)}`)
          );
        }
      });
    });
  }

  /**
   * Sign data (for authentication, etc.)
   * Note: Not all wallets support signData. This is a TON Connect extension.
   */
  async signData(data: string | Uint8Array, version: string = '1.0'): Promise<{ signature: string; timestamp: number }> {
    // Check if connected
    if (!this.currentStatus.connected || !this.currentStatus.wallet) {
      throw new TonConnectError('Not connected to wallet. Call connect() first.');
    }

    // Helper function to encode bytes to base64
    const base64EncodeBytes = (bytes: Uint8Array): string => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';
      let i = 0;
      
      while (i < bytes.length) {
        const a = bytes[i++];
        const b = i < bytes.length ? bytes[i++] : 0;
        const c = i < bytes.length ? bytes[i++] : 0;
        
        const bitmap = (a << 16) | (b << 8) | c;
        
        result += chars.charAt((bitmap >> 18) & 63);
        result += chars.charAt((bitmap >> 12) & 63);
        result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
        result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
      }
      
      return result;
    };

    // Helper function to get TextEncoder
    const getTextEncoder = (): { encode(input: string): Uint8Array } => {
      // eslint-disable-next-line no-undef
      if (typeof globalThis !== 'undefined' && (globalThis as any).TextEncoder) {
        // eslint-disable-next-line no-undef
        return new (globalThis as any).TextEncoder();
      }
      // Fallback: manual encoding
      return {
        encode(input: string): Uint8Array {
          const bytes = new Uint8Array(input.length);
          for (let i = 0; i < input.length; i++) {
            bytes[i] = input.charCodeAt(i);
          }
          return bytes;
        },
      };
    };

    // Convert data to base64
    let dataBase64: string;
    if (typeof data === 'string') {
      // Check if it's already base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (base64Regex.test(data) && data.length % 4 === 0) {
        // Likely base64, use as-is
        dataBase64 = data;
      } else {
        // Not base64, encode it
        const encoder = getTextEncoder();
        const bytes = encoder.encode(data);
        dataBase64 = base64EncodeBytes(bytes);
      }
    } else {
      // Uint8Array - convert to base64
      dataBase64 = base64EncodeBytes(data);
    }

    // Build sign data request
    const payload = {
      manifestUrl: this.config.manifestUrl,
      data: dataBase64,
      version,
      returnStrategy: this.currentWallet.preferredReturnStrategy || 'back',
      returnScheme: this.currentWallet.requiresReturnScheme !== false ? this.config.scheme : undefined,
    };

    // Encode payload
    const { encodeBase64URL } = require('./core/protocol');
    const encoded = encodeBase64URL(payload);

    // Build URL
    const baseUrl = this.currentWallet.universalLink.endsWith('/ton-connect')
      ? this.currentWallet.universalLink
      : `${this.currentWallet.universalLink}/ton-connect`;
    const url = `${baseUrl}/sign-data?${encoded}`;

    // Open wallet app and wait for response
    return new Promise<{ signature: string; timestamp: number }>((resolve, reject) => {
      let timeout: number | null = null;
      let resolved = false;

      // CRITICAL FIX: Check if sign data is already in progress
      if (this.signDataPromise) {
        throw new TonConnectError('Sign data request already in progress');
      }

      // Create promise for sign data
      const signDataPromise = {
        resolve: (response: { signature: string; timestamp: number }) => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
          resolved = true;
          if (this.signDataPromise === signDataPromise) {
            this.signDataPromise = null;
          }
          resolve(response);
        },
        reject: (error: Error) => {
          if (timeout !== null) {
            clearTimeout(timeout);
          }
          resolved = true;
          if (this.signDataPromise === signDataPromise) {
            this.signDataPromise = null;
          }
          reject(error);
        },
        timeout: null as number | null,
      };

      // Set timeout
      timeout = setTimeout(() => {
        if (!resolved && this.signDataPromise === signDataPromise) {
          this.signDataPromise = null;
          signDataPromise.reject(new TonConnectError('Sign data request timed out'));
        }
      }, this.config.transactionTimeout) as unknown as number;

      signDataPromise.timeout = timeout;

      // Store promise for callback handling
      // CRITICAL FIX: Don't mutate handleCallback method - use a separate tracking mechanism
      this.signDataPromise = signDataPromise;

      // Open URL
      this.adapter.openURL(url, this.config.skipCanOpenURLCheck).then(() => {
        // URL opened, wait for callback
        // Callback will be handled by handleCallback method checking signDataPromise
      }).catch((error: Error) => {
        // Clear promise on error
        this.signDataPromise = null;
        signDataPromise.reject(new TonConnectError(`Failed to open wallet: ${error?.message || String(error)}`));
      });
    });
  }

  /**
   * Disconnect from wallet
   */
  async disconnect(): Promise<void> {
    // Clear session
    await this.clearSession();

    // Update status
    this.currentStatus = { connected: false, wallet: null };
    this.notifyStatusChange();

    // Emit disconnect event
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
   * Note: This is a best-effort check and may not be 100% accurate
   * CRITICAL FIX: On web, if wallet has universalLink, it's considered available
   * because universal links can open in new tabs/windows
   */
  async isWalletAvailable(walletName?: string): Promise<boolean> {
    const wallet = walletName ? getWalletByName(walletName) : this.currentWallet;
    if (!wallet) {
      return false;
    }

    // CRITICAL FIX: Check adapter type to reliably detect web platform
    // WebAdapter is only used on web, so this is the most reliable check
    const isWeb = this.adapter.constructor.name === 'WebAdapter';
    
    if (isWeb) {
      // On web, if wallet has universalLink or supports web platform, it's available
      // Universal links can open in a new tab on web
      return wallet.platforms.includes('web') || !!wallet.universalLink;
    }

    // On mobile, we can't reliably check if wallet is installed
    // Return true if wallet supports the current platform
    // eslint-disable-next-line no-undef
    const platform = typeof globalThis !== 'undefined' && (globalThis as any).Platform
      ? (globalThis as any).Platform.OS === 'ios' ? 'ios' : 'android'
      : 'android';
    
    return wallet.platforms.includes(platform);
  }

  /**
   * Set preferred wallet for connections
   */
  setPreferredWallet(walletName: string): void {
    const wallet = getWalletByName(walletName);
    if (!wallet) {
      throw new TonConnectError(`Wallet "${walletName}" not found. Available wallets: ${SUPPORTED_WALLETS.map(w => w.name).join(', ')}`);
    }
    
    // CRITICAL FIX: Clear any pending connection when wallet changes
    if (this.connectionPromise) {
      console.log('[TON Connect] Clearing pending connection due to wallet change');
      if (this.connectionPromise.timeout !== null) {
        clearTimeout(this.connectionPromise.timeout);
      }
      this.connectionPromise = null;
    }
    
    this.currentWallet = wallet;
    console.log('[TON Connect] Preferred wallet changed to:', wallet.name);
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusChangeCallbacks.add(callback);

    // Immediately call with current status
    callback(this.getStatus());

    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks.delete(callback);
    };
  }

  /**
   * Notify all status change callbacks
   */
  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusChangeCallbacks.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        // Ignore errors in callbacks
      }
    });
    // Emit statusChange event
    this.emit('statusChange', status);
  }

  /**
   * Emit event to all listeners
   */
  private emit<T>(event: TonConnectEventType, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[TON Connect] Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Add event listener
   */
  on<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    };
  }

  /**
   * Remove event listener
   */
  off<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners(event?: TonConnectEventType): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  /**
   * Validate session ID format
   */
  private validateSessionId(sessionId: string): boolean {
    if (!sessionId || typeof sessionId !== 'string') {
      return false;
    }
    // Session ID should be reasonable length (1-200 characters)
    if (sessionId.length === 0 || sessionId.length > 200) {
      return false;
    }
    // Basic validation: should not contain control characters
    if (/[\x00-\x1F\x7F]/.test(sessionId)) {
      return false;
    }
    return true;
  }

  /**
   * Save session to storage
   */
  private async saveSession(sessionId: string, wallet: WalletInfo): Promise<void> {
    // Validate inputs
    if (!this.validateSessionId(sessionId)) {
      throw new TonConnectError('Invalid session ID format');
    }
    if (!wallet || !wallet.address || !wallet.publicKey) {
      throw new TonConnectError('Invalid wallet data');
    }

    try {
      const sessionKey = `${this.config.storageKeyPrefix}session`;
      const walletKey = `${this.config.storageKeyPrefix}wallet`;

      await this.adapter.setItem(sessionKey, sessionId);
      await this.adapter.setItem(walletKey, JSON.stringify(wallet));
    } catch (error) {
      // Log error but don't throw - connection is still valid
      console.error('TON Connect: Failed to save session to storage:', error);
    }
  }

  /**
   * Load session from storage
   */
  private async loadSession(): Promise<void> {
    try {
      const sessionKey = `${this.config.storageKeyPrefix}session`;
      const walletKey = `${this.config.storageKeyPrefix}wallet`;

      const sessionId = await this.adapter.getItem(sessionKey);
      const walletJson = await this.adapter.getItem(walletKey);

      if (sessionId && walletJson) {
        try {
          // Validate session ID
          if (!this.validateSessionId(sessionId)) {
            await this.clearSession();
            return;
          }

          const wallet = JSON.parse(walletJson) as WalletInfo;

          // Validate wallet data
          if (!wallet || !wallet.address || !wallet.publicKey) {
            await this.clearSession();
            return;
          }

          this.currentStatus = { connected: true, wallet };
          this.notifyStatusChange();
        } catch (error) {
          // Invalid wallet data, clear it
          console.error('TON Connect: Invalid session data, clearing:', error);
          await this.clearSession();
        }
      }
    } catch (error) {
      // Log storage errors for debugging
      console.error('TON Connect: Failed to load session from storage:', error);
    }
  }

  /**
   * Clear session from storage
   */
  private async clearSession(): Promise<void> {
    try {
      const sessionKey = `${this.config.storageKeyPrefix}session`;
      const walletKey = `${this.config.storageKeyPrefix}wallet`;

      await this.adapter.removeItem(sessionKey);
      await this.adapter.removeItem(walletKey);
    } catch (error) {
      // Ignore storage errors
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.urlUnsubscribe) {
      this.urlUnsubscribe();
      this.urlUnsubscribe = null;
    }

    if ('destroy' in this.adapter && typeof (this.adapter as { destroy?: () => void }).destroy === 'function') {
      (this.adapter as { destroy: () => void }).destroy();
    }

    this.statusChangeCallbacks.clear();
    this.eventListeners.clear();
    this.connectionPromise = null;
    this.transactionPromise = null;
    this.signDataPromise = null;
  }

  /**
   * Get current network
   */
  getNetwork(): Network {
    return this.config.network;
  }

  /**
   * Set network (mainnet/testnet)
   */
  setNetwork(network: Network): void {
    if (network !== 'mainnet' && network !== 'testnet') {
      throw new TonConnectError('Network must be either "mainnet" or "testnet"');
    }

    const oldNetwork = this.config.network;
    
    // Warn if switching network while connected (wallet connection is network-specific)
    if (this.currentStatus.connected && oldNetwork !== network) {
      console.warn(
        '[TON Connect] Network changed while wallet is connected. ' +
        'The wallet connection may be invalid for the new network. ' +
        'Consider disconnecting and reconnecting after network change.'
      );
    }

    this.config.network = network;

    // Update TON API endpoint if not explicitly set
    if (!this.config.tonApiEndpoint || this.config.tonApiEndpoint.includes(oldNetwork)) {
      this.config.tonApiEndpoint =
        network === 'testnet'
          ? 'https://testnet.toncenter.com/api/v2'
          : 'https://toncenter.com/api/v2';
    }

    console.log('[TON Connect] Network changed to:', network);
    
    // Notify status change to update chain ID in React components
    this.notifyStatusChange();
  }

  /**
   * Get wallet balance
   */
  async getBalance(address?: string): Promise<BalanceResponse> {
    const targetAddress = address || this.currentStatus.wallet?.address;
    if (!targetAddress) {
      throw new TonConnectError('Address is required. Either connect a wallet or provide an address.');
    }

    // Validate address format
    if (!/^[0-9A-Za-z_-]{48}$/.test(targetAddress)) {
      throw new TonConnectError('Invalid TON address format');
    }

    try {
      const apiEndpoint = this.config.tonApiEndpoint || 
        (this.config.network === 'testnet'
          ? 'https://testnet.toncenter.com/api/v2'
          : 'https://toncenter.com/api/v2');

      const url = `${apiEndpoint}/getAddressInformation?address=${encodeURIComponent(targetAddress)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new TonConnectError(`Failed to fetch balance: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.ok === false) {
        throw new TonConnectError(data.error || 'Failed to fetch balance');
      }

      // TON Center API returns balance in nanotons
      const balance = data.result?.balance || '0';
      const balanceTon = (BigInt(balance) / BigInt(1000000000)).toString() + '.' + 
        (BigInt(balance) % BigInt(1000000000)).toString().padStart(9, '0').replace(/0+$/, '');

      return {
        balance,
        balanceTon: balanceTon === '0.' ? '0' : balanceTon,
        network: this.config.network,
      };
    } catch (error: any) {
      if (error instanceof TonConnectError) {
        throw error;
      }
      throw new TonConnectError(`Failed to get balance: ${error?.message || String(error)}`);
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(boc: string, maxAttempts: number = 10, intervalMs: number = 2000): Promise<TransactionStatusResponse> {
    if (!boc || typeof boc !== 'string' || boc.length === 0) {
      throw new TonConnectError('Transaction BOC is required');
    }

    // Extract transaction hash from BOC (simplified - in production, you'd parse the BOC properly)
    // For now, we'll use a polling approach with TON Center API
    try {
      const apiEndpoint = this.config.tonApiEndpoint || 
        (this.config.network === 'testnet'
          ? 'https://testnet.toncenter.com/api/v2'
          : 'https://toncenter.com/api/v2');

      // Try to get transaction info
      // Note: This is a simplified implementation. In production, you'd need to:
      // 1. Parse the BOC to extract transaction hash
      // 2. Query the blockchain for transaction status
      // 3. Handle different confirmation states

      // For now, we'll return a basic status
      // In a real implementation, you'd query the blockchain API
      let attempts = 0;
      let lastError: Error | null = null;

      while (attempts < maxAttempts) {
        try {
          // This is a placeholder - you'd need to implement actual transaction lookup
          // For now, we'll simulate checking
          await new Promise<void>((resolve) => setTimeout(() => resolve(), intervalMs));

          // In production, you would:
          // 1. Parse BOC to get transaction hash
          // 2. Query TON API: GET /getTransactions?address=...&limit=1
          // 3. Check if transaction exists and is confirmed

          // For now, return unknown status (as we can't parse BOC without additional libraries)
          return {
            status: 'unknown',
            error: 'Transaction status checking requires BOC parsing. Please use a TON library to parse the BOC and extract the transaction hash.',
          };
        } catch (error: any) {
          lastError = error;
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise<void>((resolve) => setTimeout(() => resolve(), intervalMs));
          }
        }
      }

      return {
        status: 'failed',
        error: lastError?.message || 'Failed to check transaction status',
      };
    } catch (error: any) {
      throw new TonConnectError(`Failed to get transaction status: ${error?.message || String(error)}`);
    }
  }

  /**
   * Get transaction status by hash (more reliable than BOC)
   */
  async getTransactionStatusByHash(txHash: string, address: string): Promise<TransactionStatusResponse> {
    if (!txHash || typeof txHash !== 'string' || txHash.length === 0) {
      throw new TonConnectError('Transaction hash is required');
    }
    if (!address || typeof address !== 'string' || address.length === 0) {
      throw new TonConnectError('Address is required');
    }

    try {
      const apiEndpoint = this.config.tonApiEndpoint || 
        (this.config.network === 'testnet'
          ? 'https://testnet.toncenter.com/api/v2'
          : 'https://toncenter.com/api/v2');

      // Query transactions for the address
      const url = `${apiEndpoint}/getTransactions?address=${encodeURIComponent(address)}&limit=100`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new TonConnectError(`Failed to fetch transactions: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.ok === false) {
        throw new TonConnectError(data.error || 'Failed to fetch transactions');
      }

      // Search for transaction with matching hash
      const transactions = data.result || [];
      const transaction = transactions.find((tx: any) => 
        tx.transaction_id?.hash === txHash || 
        tx.transaction_id?.lt === txHash ||
        JSON.stringify(tx.transaction_id).includes(txHash)
      );

      if (transaction) {
        return {
          status: 'confirmed',
          hash: transaction.transaction_id?.hash || txHash,
          blockNumber: transaction.transaction_id?.lt,
        };
      }

      // Transaction not found - could be pending or failed
      return {
        status: 'pending',
        hash: txHash,
      };
    } catch (error: any) {
      if (error instanceof TonConnectError) {
        throw error;
      }
      return {
        status: 'failed',
        error: error?.message || 'Failed to check transaction status',
      };
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

