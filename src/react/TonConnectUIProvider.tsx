/**
 * React integration layer for TON Connect Mobile SDK
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
 * Transaction response
 */
export interface TransactionResponse {
  boc: string;
}

/**
 * TonConnect UI instance interface
 */
export interface TonConnectUI {
  openModal: () => Promise<void>;
  closeModal: () => void;
  connectWallet: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendTransaction: (transaction: SendTransactionRequest) => Promise<TransactionResponse>;
  restoreConnection: () => Promise<void>;
  setWalletList: (wallets: WalletDefinition[]) => void;
  getNetwork: () => Network;
  setNetwork: (network: Network) => void;
  getBalance: (address?: string) => Promise<BalanceResponse>;
  getTransactionStatusByHash: (txHash: string, address: string) => Promise<TransactionStatusResponse>;
  on: <T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>) => () => void;
  off: <T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>) => void;
  wallet: WalletState | null;
  modalState: { open: boolean };
  uiVersion: string;
}

interface TonConnectUIContextValue {
  tonConnectUI: TonConnectUI;
  sdk: TonConnectMobile;
}

const TonConnectUIContext = createContext<TonConnectUIContextValue | null>(null);

export interface TonConnectUIProviderProps {
  config: TonConnectMobileConfig;
  children: ReactNode;
  sdkInstance?: TonConnectMobile;
}

/**
 * TonConnectUIProvider - React context provider for TON Connect
 */
export function TonConnectUIProvider({
  config,
  children,
  sdkInstance,
}: TonConnectUIProviderProps): JSX.Element {
  const [sdk] = useState<TonConnectMobile>(() => {
    if (sdkInstance) return sdkInstance;
    return new TonConnectMobile(config);
  });
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [customWalletList, setCustomWalletList] = useState<WalletDefinition[] | null>(null);

  const getChainId = useCallback((network: Network): number => {
    return network === 'testnet' ? -3 : -239;
  }, []);

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

  useEffect(() => {
    const initialStatus = sdk.getStatus();
    updateWalletState(initialStatus);

    const unsubscribe = sdk.onStatusChange((status) => {
      updateWalletState(status);
      if (status.connected) {
        setModalOpen(false);
        setIsConnecting(false);
      }
    });

    return () => { unsubscribe(); };
  }, [sdk, updateWalletState]);

  const openModal = useCallback(async () => {
    if (!walletState?.connected) {
      setModalOpen(true);
    }
  }, [walletState?.connected]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setIsConnecting(false);
  }, []);

  const connectWallet = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await sdk.connect();
    } catch (error) {
      setIsConnecting(false);
      throw error;
    }
  }, [sdk, isConnecting]);

  const disconnect = useCallback(async () => {
    await sdk.disconnect();
    setModalOpen(false);
  }, [sdk]);

  const sendTransaction = useCallback(
    async (transaction: SendTransactionRequest): Promise<TransactionResponse> => {
      const response = await sdk.sendTransaction(transaction);
      return { boc: response.boc };
    },
    [sdk]
  );

  const restoreConnection = useCallback(async (): Promise<void> => {
    const status = sdk.getStatus();
    if (status.connected && status.wallet) {
      updateWalletState(status);
    }
  }, [sdk, updateWalletState]);

  const setWalletList = useCallback((wallets: WalletDefinition[]): void => {
    setCustomWalletList(wallets);
  }, []);

  const getNetwork = useCallback((): Network => sdk.getNetwork(), [sdk]);
  const setNetwork = useCallback((network: Network): void => {
    sdk.setNetwork(network);
    const status = sdk.getStatus();
    updateWalletState(status);
  }, [sdk, updateWalletState]);

  const getBalance = useCallback(async (address?: string): Promise<BalanceResponse> => {
    return await sdk.getBalance(address);
  }, [sdk]);

  const getTransactionStatusByHash = useCallback(async (
    txHash: string, address: string
  ): Promise<TransactionStatusResponse> => {
    return await sdk.getTransactionStatusByHash(txHash, address);
  }, [sdk]);

  const on = useCallback(<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): (() => void) => {
    return sdk.on(event, listener);
  }, [sdk]);

  const off = useCallback(<T = any>(event: TonConnectEventType, listener: TonConnectEventListener<T>): void => {
    sdk.off(event, listener);
  }, [sdk]);

  const tonConnectUI: TonConnectUI = {
    openModal,
    closeModal,
    connectWallet,
    disconnect,
    sendTransaction,
    restoreConnection,
    setWalletList,
    getNetwork,
    setNetwork,
    getBalance,
    getTransactionStatusByHash,
    on,
    off,
    wallet: walletState,
    modalState: { open: modalOpen },
    uiVersion: '2.0.0',
  };

  const contextValue: TonConnectUIContextValue = { tonConnectUI, sdk };

  return (
    <TonConnectUIContext.Provider value={contextValue}>
      {children}
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
 */
export function useTonWallet(): WalletState | null {
  const tonConnectUI = useTonConnectUI();
  return tonConnectUI.wallet;
}

/**
 * Hook to access modal state
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
 * Hook to access SDK instance
 */
export function useTonConnectSDK(): TonConnectMobile {
  const context = useContext(TonConnectUIContext);
  if (!context) {
    throw new Error('useTonConnectSDK must be used within TonConnectUIProvider');
  }
  return context.sdk;
}
