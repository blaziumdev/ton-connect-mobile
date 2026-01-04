/**
 * React integration layer for @tonconnect/ui-react compatibility
 * Provides TonConnectUIProvider, hooks, and components compatible with @tonconnect/ui-react API
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TonConnectMobile, ConnectionStatus, WalletInfo, SendTransactionRequest, WalletDefinition, Network, BalanceResponse, TransactionStatusResponse } from '../index';
import type { TonConnectMobileConfig, TonConnectEventType, TonConnectEventListener } from '../types';
import { WalletSelectionModal } from './WalletSelectionModal';

/**
 * Account information (compatible with @tonconnect/ui-react)
 */
export interface Account {
  address: string;
  chain: number;
  publicKey?: string;
}

/**
 * Wallet state (compatible with @tonconnect/ui-react)
 */
export interface WalletState {
  account: Account | null;
  wallet: WalletInfo | null;
  connected: boolean;
}

/**
 * Transaction response (compatible with @tonconnect/ui-react)
 */
export interface TransactionResponse {
  boc: string;
  signature: string;
}

/**
 * Sign data request
 */
export interface SignDataRequest {
  /** Data to sign (will be base64 encoded) */
  data: string | Uint8Array;
  /** Optional version */
  version?: string;
}

/**
 * Sign data response
 */
export interface SignDataResponse {
  signature: string;
  timestamp: number;
}

/**
 * TonConnect UI instance interface (compatible with @tonconnect/ui-react)
 * Includes all features from @tonconnect/ui-react for full compatibility
 */
export interface TonConnectUI {
  /** Open connection modal */
  openModal: () => Promise<void>;
  /** Close connection modal */
  closeModal: () => void;
  /** Connect to wallet */
  connectWallet: () => Promise<void>;
  /** Disconnect from wallet */
  disconnect: () => Promise<void>;
  /** Send transaction */
  sendTransaction: (transaction: SendTransactionRequest) => Promise<TransactionResponse>;
  /** Sign data */
  signData: (request: SignDataRequest) => Promise<SignDataResponse>;
  /** Restore connection from stored session */
  restoreConnection: () => Promise<void>;
  /** Set wallet list (customize available wallets) */
  setWalletList: (wallets: WalletDefinition[]) => void;
  /** Get current network */
  getNetwork: () => Network;
  /** Set network (mainnet/testnet) */
  setNetwork: (network: Network) => void;
  /** Get wallet balance */
  getBalance: (address?: string) => Promise<BalanceResponse>;
  /** Get transaction status */
  getTransactionStatus: (boc: string, maxAttempts?: number, intervalMs?: number) => Promise<TransactionStatusResponse>;
  /** Get transaction status by hash */
  getTransactionStatusByHash: (txHash: string, address: string) => Promise<TransactionStatusResponse>;
  /** Add event listener */
  on: <T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>) => () => void;
  /** Remove event listener */
  off: <T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>) => void;
  /** Current wallet state */
  wallet: WalletState | null;
  /** Modal open state */
  modalState: {
    open: boolean;
  };
  /** UI kit version */
  uiVersion: string;
}

/**
 * Context value
 */
interface TonConnectUIContextValue {
  tonConnectUI: TonConnectUI;
  sdk: TonConnectMobile;
}

const TonConnectUIContext = createContext<TonConnectUIContextValue | null>(null);

/**
 * TonConnectUIProvider props
 */
export interface TonConnectUIProviderProps {
  /** SDK configuration */
  config: TonConnectMobileConfig;
  /** Children */
  children: ReactNode;
  /** Optional SDK instance (for testing or custom instances) */
  sdkInstance?: TonConnectMobile;
}

/**
 * TonConnectUIProvider - React context provider for TON Connect
 * Compatible with @tonconnect/ui-react API
 */
export function TonConnectUIProvider({
  config,
  children,
  sdkInstance,
}: TonConnectUIProviderProps): JSX.Element {
  // CRITICAL: Initialize SDK only once
  const [sdk] = useState<TonConnectMobile>(() => {
    if (sdkInstance) {
      return sdkInstance;
    }
    try {
      return new TonConnectMobile(config);
    } catch (error) {
      console.error('[TonConnectUIProvider] Failed to initialize SDK:', error);
      throw error;
    }
  });
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [customWalletList, setCustomWalletList] = useState<WalletDefinition[] | null>(null);

  // Get chain ID based on network
  const getChainId = useCallback((network: Network): number => {
    // TON mainnet chain ID: -239
    // TON testnet chain ID: -3
    return network === 'testnet' ? -3 : -239;
  }, []);

  // Update wallet state from SDK status
  const updateWalletState = useCallback((status: ConnectionStatus) => {
    if (status.connected && status.wallet) {
      const network = sdk.getNetwork();
      setWalletState({
        account: {
          address: status.wallet.address,
          chain: getChainId(network),
          publicKey: status.wallet.publicKey,
        },
        wallet: status.wallet,
        connected: true,
      });
    } else {
      setWalletState({
        account: null,
        wallet: null,
        connected: false,
      });
    }
  }, [sdk, getChainId]);

  // Subscribe to SDK status changes
  useEffect(() => {
    // Set initial state
    const initialStatus = sdk.getStatus();
    updateWalletState(initialStatus);

    // Subscribe to changes
    const unsubscribe = sdk.onStatusChange((status) => {
      updateWalletState(status);
      // Close modal when connected
      if (status.connected) {
        setModalOpen(false);
        setIsConnecting(false);
      }
    });

    return () => {
      unsubscribe();
      // CRITICAL FIX: Cleanup SDK on unmount to prevent memory leaks
      // Note: SDK has its own cleanup via destroy(), but we don't call it here
      // to allow SDK to persist across component remounts (e.g., navigation)
    };
  }, [sdk, updateWalletState]);

  // Open modal
  const openModal = useCallback(async () => {
    if (!walletState?.connected) {
      setModalOpen(true);
    }
  }, [walletState?.connected]);

  // Close modal
  const closeModal = useCallback(() => {
    setModalOpen(false);
    setIsConnecting(false);
  }, []);

  // Connect wallet
  const connectWallet = useCallback(async () => {
    // CRITICAL FIX: Use functional update to avoid race condition
    setIsConnecting((prev) => {
      if (prev) {
        // Already connecting, return early
        return prev;
      }
      return true;
    });

    // Wait for connection
    try {
      await sdk.connect();
      // Status update will be handled by the subscription
    } catch (error) {
      setIsConnecting(false);
      throw error;
    }
  }, [sdk]);

  // Disconnect
  const disconnect = useCallback(async () => {
    await sdk.disconnect();
    setModalOpen(false);
  }, [sdk]);

  // Send transaction
  const sendTransaction = useCallback(
    async (transaction: SendTransactionRequest): Promise<TransactionResponse> => {
      try {
        // Validate transaction before sending
        if (!transaction || !transaction.messages || transaction.messages.length === 0) {
          throw new Error('Invalid transaction: messages array is required and cannot be empty');
        }
        if (!transaction.validUntil || transaction.validUntil <= Date.now()) {
          throw new Error('Invalid transaction: validUntil must be in the future');
        }

        const response = await sdk.sendTransaction(transaction);
        return {
          boc: response.boc,
          signature: response.signature,
        };
      } catch (error) {
        console.error('[TonConnectUIProvider] Transaction error:', error);
        throw error;
      }
    },
    [sdk]
  );

  // Sign data
  const signData = useCallback(
    async (request: SignDataRequest): Promise<SignDataResponse> => {
      try {
        // Validate request
        if (!request || (!request.data && request.data !== '')) {
          throw new Error('Invalid sign data request: data is required');
        }

        const response = await sdk.signData(request.data, request.version);
        return {
          signature: response.signature,
          timestamp: response.timestamp,
        };
      } catch (error) {
        console.error('[TonConnectUIProvider] Sign data error:', error);
        throw error;
      }
    },
    [sdk]
  );

  // Restore connection from stored session
  const restoreConnection = useCallback(async (): Promise<void> => {
    try {
      // SDK automatically loads session on initialization
      // This method triggers a re-check of the stored session
      const status = sdk.getStatus();
      if (status.connected && status.wallet) {
        updateWalletState(status);
      }
    } catch (error) {
      console.error('[TonConnectUIProvider] Restore connection error:', error);
      throw error;
    }
  }, [sdk, updateWalletState]);

  // Set wallet list (customize available wallets)
  const setWalletList = useCallback((wallets: WalletDefinition[]): void => {
    if (!wallets || !Array.isArray(wallets)) {
      throw new Error('Wallet list must be an array');
    }
    setCustomWalletList(wallets);
  }, []);

  // Get network
  const getNetwork = useCallback((): Network => {
    return sdk.getNetwork();
  }, [sdk]);

  // Set network
  const setNetwork = useCallback((network: Network): void => {
    sdk.setNetwork(network);
    // Update wallet state to reflect new chain ID
    const status = sdk.getStatus();
    updateWalletState(status);
  }, [sdk, updateWalletState]);

  // Get balance
  const getBalance = useCallback(async (address?: string): Promise<BalanceResponse> => {
    return await sdk.getBalance(address);
  }, [sdk]);

  // Get transaction status
  const getTransactionStatus = useCallback(async (
    boc: string,
    maxAttempts: number = 10,
    intervalMs: number = 2000
  ): Promise<TransactionStatusResponse> => {
    return await sdk.getTransactionStatus(boc, maxAttempts, intervalMs);
  }, [sdk]);

  // Get transaction status by hash
  const getTransactionStatusByHash = useCallback(async (
    txHash: string,
    address: string
  ): Promise<TransactionStatusResponse> => {
    return await sdk.getTransactionStatusByHash(txHash, address);
  }, [sdk]);

  // Event listeners
  const on = useCallback(<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): (() => void) => {
    return sdk.on(event, listener);
  }, [sdk]);

  const off = useCallback(<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): void => {
    sdk.off(event, listener);
  }, [sdk]);

  // Create TonConnectUI instance
  const tonConnectUI: TonConnectUI = {
    openModal,
    closeModal,
    connectWallet,
    disconnect,
    sendTransaction,
    signData,
    restoreConnection,
    setWalletList,
    getNetwork,
    setNetwork,
    getBalance,
    getTransactionStatus,
    getTransactionStatusByHash,
    on,
    off,
    wallet: walletState,
    modalState: {
      open: modalOpen,
    },
    uiVersion: '1.0.0',
  };

  const contextValue: TonConnectUIContextValue = {
    tonConnectUI,
    sdk,
  };

  return (
    <TonConnectUIContext.Provider value={contextValue}>
      {children}
      {/* Auto-show wallet selection modal when modalOpen is true */}
      <WalletSelectionModal
        visible={modalOpen && !walletState?.connected}
        onClose={closeModal}
        wallets={customWalletList || undefined}
      />
    </TonConnectUIContext.Provider>
  );
}

/**
 * Hook to access TonConnectUI instance
 * Compatible with @tonconnect/ui-react useTonConnectUI hook
 */
export function useTonConnectUI(): TonConnectUI {
  const context = useContext(TonConnectUIContext);
  if (!context) {
    throw new Error('useTonConnectUI must be used within TonConnectUIProvider');
  }
  return context.tonConnectUI;
}

/**
 * Hook to access wallet state
 * Compatible with @tonconnect/ui-react useTonWallet hook
 */
export function useTonWallet(): WalletState | null {
  const tonConnectUI = useTonConnectUI();
  return tonConnectUI.wallet;
}

/**
 * Hook to access modal state
 * Compatible with @tonconnect/ui-react useTonConnectModal hook
 */
export function useTonConnectModal(): { open: boolean; close: () => void; openModal: () => Promise<void> } {
  const tonConnectUI = useTonConnectUI();
  return {
    open: tonConnectUI.modalState.open,
    close: tonConnectUI.closeModal,
    openModal: tonConnectUI.openModal,
  };
}

/**
 * Hook to access SDK instance (for advanced usage)
 */
export function useTonConnectSDK(): TonConnectMobile {
  const context = useContext(TonConnectUIContext);
  if (!context) {
    throw new Error('useTonConnectSDK must be used within TonConnectUIProvider');
  }
  return context.sdk;
}

