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
} from './types';
import {
  buildConnectionRequest,
  buildTransactionRequest,
  parseCallbackURL,
  extractWalletInfo,
  validateConnectionResponse,
  validateTransactionRequest,
  validateTransactionResponse,
} from './core/protocol';
import type {
  ConnectionResponsePayload,
  TransactionResponsePayload,
  ErrorResponse,
} from './types';
import { verifyConnectionProof, generateSessionId } from './core/crypto';
import { ExpoAdapter } from './adapters/expo';
import { ReactNativeAdapter } from './adapters/react-native';
import { WebAdapter } from './adapters/web';

/**
 * Custom error classes
 */
export class TonConnectError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'TonConnectError';
  }
}

export class ConnectionTimeoutError extends TonConnectError {
  constructor() {
    super('Connection request timed out', 'CONNECTION_TIMEOUT');
    this.name = 'ConnectionTimeoutError';
  }
}

export class TransactionTimeoutError extends TonConnectError {
  constructor() {
    super('Transaction request timed out', 'TRANSACTION_TIMEOUT');
    this.name = 'TransactionTimeoutError';
  }
}

export class UserRejectedError extends TonConnectError {
  constructor() {
    super('User rejected the request', 'USER_REJECTED');
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
 */
export class TonConnectMobile {
  private adapter: PlatformAdapter;
  private config: Required<TonConnectMobileConfig>;
  private statusChangeCallbacks: Set<StatusChangeCallback> = new Set();
  private currentStatus: ConnectionStatus = { connected: false, wallet: null };
  private urlUnsubscribe: (() => void) | null = null;
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

  constructor(config: TonConnectMobileConfig) {
    // Validate config
    if (!config.manifestUrl) {
      throw new TonConnectError('manifestUrl is required');
    }
    if (!config.scheme) {
      throw new TonConnectError('scheme is required');
    }

    this.config = {
      storageKeyPrefix: 'tonconnect_',
      connectionTimeout: 300000, // 5 minutes
      transactionTimeout: 300000, // 5 minutes
      ...config,
    };

    // Initialize platform adapter
    this.adapter = this.createAdapter();

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
      return new WebAdapter();
    }

    // Try to detect Expo environment
    try {
      // Check if expo-linking is available
      if (typeof require !== 'undefined') {
        const expoLinking = require('expo-linking');
        if (expoLinking) {
          return new ExpoAdapter();
        }
      }
    } catch {
      // expo-linking not available, continue to React Native adapter
    }

    // Fall back to React Native adapter
    // This will work for both React Native CLI and Expo (since Expo also has react-native)
    return new ReactNativeAdapter();
  }

  /**
   * Set up URL listener for wallet callbacks
   */
  private setupURLListener(): void {
    this.urlUnsubscribe = this.adapter.addURLListener((url) => {
      this.handleCallback(url);
    });

    // Also check initial URL (when app was opened via deep link)
    this.adapter.getInitialURL().then((url) => {
      if (url) {
        this.handleCallback(url);
      }
    });
  }

  /**
   * Handle callback from wallet
   */
  private handleCallback(url: string): void {
    const parsed = parseCallbackURL(url, this.config.scheme);

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

    // Resolve connection promise
    if (this.connectionPromise) {
      if (this.connectionPromise.timeout !== null) {
        clearTimeout(this.connectionPromise.timeout);
      }
      this.connectionPromise.resolve(wallet);
      this.connectionPromise = null;
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

    // Resolve transaction promise
    if (this.transactionPromise) {
      if (this.transactionPromise.timeout !== null) {
        clearTimeout(this.transactionPromise.timeout);
      }
      this.transactionPromise.resolve({
        boc: response.boc,
        signature: response.signature,
      });
      this.transactionPromise = null;
    }
  }

  /**
   * Reject current promise with error
   */
  private rejectWithError(error: Error): void {
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
  }

  /**
   * Connect to wallet
   */
  async connect(): Promise<WalletInfo> {
    // If already connected, return current wallet
    if (this.currentStatus.connected && this.currentStatus.wallet) {
      return this.currentStatus.wallet;
    }

    // CRITICAL FIX: Check if connection is already in progress
    if (this.connectionPromise) {
      throw new ConnectionInProgressError();
    }

    // Build connection request URL
    const url = buildConnectionRequest(this.config.manifestUrl, this.config.scheme);

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
          this.connectionPromise.reject(new ConnectionTimeoutError());
        }
      }, this.config.connectionTimeout) as unknown as number;

      this.connectionPromise.timeout = timeout;

      // Open wallet app
      this.adapter.openURL(url).catch((error) => {
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

    // Build transaction request URL
    const url = buildTransactionRequest(this.config.manifestUrl, request, this.config.scheme);

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
      this.adapter.openURL(url).catch((error) => {
        if (this.transactionPromise) {
          this.transactionPromise.reject(
            new TonConnectError(`Failed to open wallet: ${error?.message || String(error)}`)
          );
        }
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
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.currentStatus };
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
    this.connectionPromise = null;
    this.transactionPromise = null;
  }
}

// Export types
export * from './types';

