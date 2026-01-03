/**
 * React integration layer for @tonconnect/ui-react compatibility
 * Provides TonConnectUIProvider, hooks, and components compatible with @tonconnect/ui-react API
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TonConnectMobile, ConnectionStatus, WalletInfo, SendTransactionRequest } from '../index';
import type { TonConnectMobileConfig } from '../types';

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
  const [sdk] = useState<TonConnectMobile>(() => sdkInstance || new TonConnectMobile(config));
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Update wallet state from SDK status
  const updateWalletState = useCallback((status: ConnectionStatus) => {
    if (status.connected && status.wallet) {
      setWalletState({
        account: {
          address: status.wallet.address,
          chain: -239, // TON mainnet chain ID
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
  }, []);

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
    setModalOpen(true);
  }, []);

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
      const response = await sdk.sendTransaction(transaction);
      return {
        boc: response.boc,
        signature: response.signature,
      };
    },
    [sdk]
  );

  // Sign data
  const signData = useCallback(
    async (request: SignDataRequest): Promise<SignDataResponse> => {
      const response = await sdk.signData(request.data, request.version);
      return {
        signature: response.signature,
        timestamp: response.timestamp,
      };
    },
    [sdk]
  );

  // Create TonConnectUI instance
  const tonConnectUI: TonConnectUI = {
    openModal,
    closeModal,
    connectWallet,
    disconnect,
    sendTransaction,
    signData,
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

  return <TonConnectUIContext.Provider value={contextValue}>{children}</TonConnectUIContext.Provider>;
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

