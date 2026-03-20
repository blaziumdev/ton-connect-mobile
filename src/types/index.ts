/**
 * Core types for TON Connect Mobile SDK
 * Types for TON Connect v2 protocol
 */

/**
 * Wallet information returned after successful connection
 */
export interface WalletInfo {
  /** Wallet name (e.g., "Tonkeeper") */
  name: string;
  /** Wallet app name */
  appName: string;
  /** Wallet app version */
  version: string;
  /** Platform */
  platform: 'ios' | 'android' | 'unknown';
  /** TON address (raw format: workchain:hash) */
  address: string;
  /** Public key in hex format */
  publicKey: string;
  /** Network identifier ("-239" = mainnet, "-3" = testnet) */
  network?: string;
  /** Wallet state init (base64) */
  walletStateInit?: string;
  /** Wallet icon URL */
  icon?: string;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  connected: boolean;
  wallet: WalletInfo | null;
}

/**
 * Transaction message to send
 */
export interface TransactionMessage {
  /** Recipient address */
  address: string;
  /** Amount in nanotons */
  amount: string;
  /** Optional message payload (base64 encoded) */
  payload?: string;
  /** Optional state init (base64 encoded) */
  stateInit?: string;
}

/**
 * Transaction request parameters
 */
export interface SendTransactionRequest {
  /** Unix timestamp (ms) when the request expires */
  validUntil: number;
  /** Array of messages to send */
  messages: TransactionMessage[];
  /** Optional network */
  network?: 'mainnet' | 'testnet';
  /** Optional from address */
  from?: string;
}

/**
 * Platform adapter interface
 */
export interface PlatformAdapter {
  openURL(url: string, skipCanOpenURLCheck?: boolean): Promise<boolean>;
  getInitialURL(): Promise<string | null>;
  addURLListener(callback: (url: string) => void): () => void;
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  randomBytes(length: number): Promise<Uint8Array>;
}

/**
 * Network type
 */
export type Network = 'mainnet' | 'testnet';

/**
 * SDK configuration
 */
export interface TonConnectMobileConfig {
  /** Manifest URL (required) */
  manifestUrl: string;
  /** Deep link scheme for callbacks (required for return strategy) */
  scheme: string;
  /** Optional storage key prefix */
  storageKeyPrefix?: string;
  /** Optional connection timeout in ms (default: 300000 = 5 minutes) */
  connectionTimeout?: number;
  /** Optional transaction timeout in ms (default: 300000 = 5 minutes) */
  transactionTimeout?: number;
  /** Skip canOpenURL check (default: true) */
  skipCanOpenURLCheck?: boolean;
  /** Preferred wallet name */
  preferredWallet?: string;
  /** Network (default: 'mainnet') */
  network?: Network;
  /** Custom TON API endpoint */
  tonApiEndpoint?: string;
}

/**
 * Status change callback
 */
export type StatusChangeCallback = (status: ConnectionStatus) => void;

/**
 * Event types
 */
export type TonConnectEventType = 'connect' | 'disconnect' | 'transaction' | 'error' | 'statusChange';

/**
 * Event listener callback
 */
export type TonConnectEventListener<T = any> = (data: T) => void;

/**
 * Transaction status
 */
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'unknown';

/**
 * Transaction status response
 */
export interface TransactionStatusResponse {
  status: TransactionStatus;
  hash?: string;
  blockNumber?: number;
  error?: string;
}

/**
 * Balance response
 */
export interface BalanceResponse {
  balance: string;
  balanceTon: string;
  network: Network;
}

// ─── TON Connect v2 Bridge Protocol Types ───

/**
 * Connect event from wallet (received via bridge after decryption)
 */
export interface ConnectEvent {
  event: 'connect';
  id: number;
  payload: {
    items: Array<{
      name: string;
      address: string;
      network: string;
      publicKey: string;
      walletStateInit?: string;
      [key: string]: any;
    }>;
    device: {
      platform: string;
      appName: string;
      appVersion: string;
      maxProtocolVersion: number;
      features: any[];
    };
  };
}

/**
 * Connect error event from wallet
 */
export interface ConnectErrorEvent {
  event: 'connect_error';
  id: number;
  payload: {
    code: number;
    message: string;
  };
}

/**
 * JSON-RPC response (success)
 */
export interface RpcResponse {
  result: string;
  id: number;
}

/**
 * JSON-RPC response (error)
 */
export interface RpcErrorResponse {
  error: {
    code: number;
    message: string;
  };
  id: number;
}

/**
 * Persisted session data
 */
export interface PersistedSession {
  /** Hex-encoded session secret key */
  sessionSecretKey: string;
  /** Hex-encoded wallet public key (from bridge "from" field) */
  walletPublicKey: string;
  /** Wallet bridge URL */
  bridgeUrl: string;
  /** Wallet info */
  wallet: WalletInfo;
}
