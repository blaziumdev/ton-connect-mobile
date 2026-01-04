/**
 * Core types for TON Connect Mobile SDK
 * These types define the protocol structure for TonConnect
 */

/**
 * Wallet information returned after successful connection
 */
export interface WalletInfo {
  /** Wallet name (e.g., "Tonkeeper", "MyTonWallet") */
  name: string;
  /** Wallet app name */
  appName: string;
  /** Wallet app version */
  version: string;
  /** Platform (ios/android) */
  platform: 'ios' | 'android' | 'unknown';
  /** TON address of the connected wallet */
  address: string;
  /** Public key in hex format */
  publicKey: string;
  /** Wallet icon URL */
  icon?: string;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  /** Whether a wallet is currently connected */
  connected: boolean;
  /** Wallet information if connected, null otherwise */
  wallet: WalletInfo | null;
}

/**
 * Transaction message to send
 */
export interface TransactionMessage {
  /** Recipient address in TON format (EQ...) */
  address: string;
  /** Amount in nanotons (1 TON = 1,000,000,000 nanotons) */
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
  /** Optional network (mainnet/testnet) */
  network?: 'mainnet' | 'testnet';
  /** Optional from address */
  from?: string;
}

/**
 * Transaction response from wallet
 */
export interface TransactionResponse {
  /** Base64 encoded BOC of the transaction */
  boc: string;
  /** Transaction signature */
  signature: string;
}

/**
 * Connection request payload (sent to wallet)
 */
export interface ConnectionRequestPayload {
  /** Manifest URL for the app */
  manifestUrl: string;
  /** Items requested from wallet */
  items: Array<{
    name: 'ton_addr';
  }>;
  /** Return strategy - how wallet should return to the app */
  returnStrategy?: 'back' | 'post_redirect' | 'none';
  /** Return scheme for mobile apps (required by many wallets for proper callback handling) */
  returnScheme?: string;
}

/**
 * Connection response payload (received from wallet)
 */
export interface ConnectionResponsePayload {
  /** Session ID */
  session: string;
  /** Wallet information */
  name: string;
  /** Wallet app name */
  appName: string;
  /** Wallet version */
  version: string;
  /** Platform */
  platform: 'ios' | 'android' | 'unknown';
  /** TON address */
  address: string;
  /** Public key in hex */
  publicKey: string;
  /** Wallet icon URL */
  icon?: string;
  /** Proof (signature) for verification */
  proof?: {
    timestamp: number;
    domain: {
      lengthBytes: number;
      value: string;
    };
    signature: string;
  };
}

/**
 * Transaction request payload (sent to wallet)
 */
export interface TransactionRequestPayload {
  /** Manifest URL */
  manifestUrl: string;
  /** Transaction request */
  request: {
    /** Unix timestamp (ms) when request expires */
    validUntil: number;
    /** Array of messages */
    messages: Array<{
      address: string;
      amount: string;
      payload?: string;
      stateInit?: string;
    }>;
    /** Optional network */
    network?: 'mainnet' | 'testnet';
    /** Optional from address */
    from?: string;
  };
  /** Return URL scheme (for mobile apps) */
  returnScheme?: string;
  /** Return strategy */
  returnStrategy?: 'back' | 'post_redirect' | 'none';
}

/**
 * Transaction response payload (received from wallet)
 */
export interface TransactionResponsePayload {
  /** Base64 encoded BOC */
  boc: string;
  /** Transaction signature */
  signature: string;
}

/**
 * Error response from wallet
 */
export interface ErrorResponse {
  /** Error code */
  error: {
    code: number;
    message: string;
  };
}

/**
 * Platform adapter interface for deep linking and storage
 */
export interface PlatformAdapter {
  /** Open a deep link URL */
  openURL(url: string, skipCanOpenURLCheck?: boolean): Promise<boolean>;
  /** Get initial URL when app was opened via deep link */
  getInitialURL(): Promise<string | null>;
  /** Add listener for URL changes */
  addURLListener(callback: (url: string) => void): () => void;
  /** Store data */
  setItem(key: string, value: string): Promise<void>;
  /** Retrieve data */
  getItem(key: string): Promise<string | null>;
  /** Remove data */
  removeItem(key: string): Promise<void>;
  /** Generate random bytes */
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
  /** Deep link scheme for callbacks (required) */
  scheme: string;
  /** Optional storage key prefix */
  storageKeyPrefix?: string;
  /** Optional connection timeout in ms (default: 300000 = 5 minutes) */
  connectionTimeout?: number;
  /** Optional transaction timeout in ms (default: 300000 = 5 minutes) */
  transactionTimeout?: number;
  /** Skip canOpenURL check before opening URL (optional, default: true)
   * Set to false if you want to check if URL can be opened before attempting to open it.
   * Note: On Android, canOpenURL may return false for tonconnect:// even if wallet is installed.
   */
  skipCanOpenURLCheck?: boolean;
  /** Preferred wallet name (optional)
   * If not specified, will use default wallet (Tonkeeper)
   * Available: 'Tonkeeper', 'MyTonWallet', 'Wallet in Telegram', 'Tonhub'
   */
  preferredWallet?: string;
  /** Network (mainnet/testnet) - default: 'mainnet' */
  network?: Network;
  /** TON API endpoint for balance checking (optional)
   * Default: 'https://toncenter.com/api/v2' for mainnet, 'https://testnet.toncenter.com/api/v2' for testnet
   */
  tonApiEndpoint?: string;
}

/**
 * Event listener callback type
 */
export type StatusChangeCallback = (status: ConnectionStatus) => void;

/**
 * Event types for TonConnectMobile
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
  /** Transaction status */
  status: TransactionStatus;
  /** Transaction hash (if available) */
  hash?: string;
  /** Block number (if confirmed) */
  blockNumber?: number;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Balance response
 */
export interface BalanceResponse {
  /** Balance in nanotons */
  balance: string;
  /** Balance in TON (formatted) */
  balanceTon: string;
  /** Network */
  network: Network;
}

