/**
 * Test project for @blazium/ton-connect-mobile
 * Demonstrates both direct SDK usage and React integration (@tonconnect/ui-react compatible)
 */

// IMPORTANT: Import react-native-get-random-values first
import 'react-native-get-random-values';

import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  TextInput,
} from 'react-native';

// New React integration (compatible with @tonconnect/ui-react)
import {
  TonConnectUIProvider,
  useTonConnectUI,
  useTonWallet,
  useTonConnectModal,
  TonConnectButton,
  useTonConnectSDK,
} from '@blazium/ton-connect-mobile/react';

// Direct SDK imports (for advanced usage)
import { TonConnectMobile } from '@blazium/ton-connect-mobile';
import type { WalletDefinition } from '@blazium/ton-connect-mobile';

// NEW: Transaction Builder Utilities
import {
  buildTransferTransaction,
  buildMultiTransferTransaction,
  tonToNano,
  formatTonAddress,
  isValidTonAddress,
} from '@blazium/ton-connect-mobile';

// NEW: Retry Utilities
import { retry } from '@blazium/ton-connect-mobile';

// NEW: Enhanced Error Classes
import {
  ConnectionTimeoutError,
  TransactionTimeoutError,
  UserRejectedError,
} from '@blazium/ton-connect-mobile';

// NEW: Network and Balance types
import type { Network, BalanceResponse, TransactionStatusResponse } from '@blazium/ton-connect-mobile';

// SDK Configuration
// FINAL FIX: Use production manifest for testing (most reliable)
// Local manifest requires running server: cd test-project/public && npx serve . -p 3000
// For Android emulator with local server: use http://10.0.2.2:3000/tonconnect-manifest.json
import { Platform } from 'react-native';

// Use production manifest - it's accessible and works reliably
// If you want to use local manifest, uncomment the local URL and start the server
const SDK_CONFIG = {
  manifestUrl: 'https://moonpaw-game.vercel.app/tonconnect-manifest.json', // Production manifest (works reliably)
  // manifestUrl: Platform.OS === 'android' 
  //   ? 'http://10.0.2.2:3000/tonconnect-manifest.json'  // Android emulator local
  //   : 'http://localhost:3000/tonconnect-manifest.json', // iOS/localhost
  scheme: 'testapp',
  network: 'mainnet' as Network, // Can be 'mainnet' or 'testnet'
};

/**
 * Main App Component - Wraps everything with TonConnectUIProvider
 */
export default function App() {
  return (
    <TonConnectUIProvider config={SDK_CONFIG}>
      <SafeAreaView style={styles.safeArea}>
        <AppContent />
      </SafeAreaView>
    </TonConnectUIProvider>
  );
}

/**
 * App Content - Uses React hooks for TON Connect
 */
function AppContent() {
  const tonConnectUI = useTonConnectUI();
  const wallet = useTonWallet();
  const modal = useTonConnectModal();
  const sdk = useTonConnectSDK(); // For advanced features like wallet selection

  const [wallets, setWallets] = useState<WalletDefinition[]>([]);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAvailability, setWalletAvailability] = useState<Record<string, boolean>>({});
  const [retryCount, setRetryCount] = useState(0);
  const [balance, setBalance] = useState<BalanceResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<TransactionStatusResponse | null>(null);
  const [eventLogs, setEventLogs] = useState<string[]>([]);
  const [showTxStatusModal, setShowTxStatusModal] = useState(false);
  const [txHashInput, setTxHashInput] = useState('');

  // Load supported wallets on mount
  React.useEffect(() => {
    const supportedWallets = sdk.getSupportedWallets();
    setWallets(supportedWallets);
    
    // NEW: Check wallet availability
    const checkAvailability = async () => {
      const availability: Record<string, boolean> = {};
      for (const wallet of supportedWallets) {
        try {
          const isAvailable = await sdk.isWalletAvailable(wallet.name);
          availability[wallet.name] = isAvailable;
        } catch (error) {
          availability[wallet.name] = false;
        }
      }
      setWalletAvailability(availability);
    };
    checkAvailability();
  }, [sdk]);

  // NEW: Setup event listeners
  React.useEffect(() => {
    const addLog = (message: string) => {
      setEventLogs((prev) => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const unsubscribeConnect = tonConnectUI.on('connect', (wallet) => {
      addLog(`✅ Connected to ${wallet.name}`);
    });

    const unsubscribeDisconnect = tonConnectUI.on('disconnect', () => {
      addLog('❌ Disconnected');
      setBalance(null);
    });

    const unsubscribeTransaction = tonConnectUI.on('transaction', (tx) => {
      addLog(`📤 Transaction sent: ${tx.boc.substring(0, 20)}...`);
    });

    const unsubscribeError = tonConnectUI.on('error', (error) => {
      addLog(`⚠️ Error: ${error.message}`);
    });

    const unsubscribeStatusChange = tonConnectUI.on('statusChange', (status) => {
      addLog(`🔄 Status: ${status.connected ? 'Connected' : 'Disconnected'}`);
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeTransaction();
      unsubscribeError();
      unsubscribeStatusChange();
    };
  }, [tonConnectUI]);

  // NEW: Handle wallet selection and connection with retry
  const handleConnectWallet = async (walletName?: string, useRetry: boolean = false) => {
    try {
      // Set preferred wallet if specified (must be done before opening modal)
      if (walletName) {
        console.log('Setting preferred wallet to:', walletName);
        sdk.setPreferredWallet(walletName);
      }

      // Close modal first
      setShowWalletModal(false);
      
      // Small delay to ensure modal closes before opening wallet
      await new Promise(resolve => setTimeout(resolve, 100));

      // NEW: Use retry utility if enabled
      if (useRetry) {
        setRetryCount(0);
        await retry(
          async () => {
            setRetryCount((prev) => prev + 1);
            await tonConnectUI.connectWallet();
          },
          {
            maxAttempts: 3,
            initialDelay: 1000,
            multiplier: 2,
            shouldRetry: (error) => {
              // Don't retry if user rejected
              return !(error instanceof UserRejectedError);
            },
          }
        );
      } else {
        // Connect to wallet (modal is already handled by TonConnectButton or custom UI)
        await tonConnectUI.connectWallet();
      }

      // Success will be handled by status change callback
    } catch (error: any) {
      console.error('Connection error:', error);
      setShowWalletModal(false);

      // NEW: Enhanced error handling with recovery suggestions
      if (error instanceof ConnectionTimeoutError) {
        Alert.alert(
          'Connection Timeout',
          `${error.message}\n\n${error.recoverySuggestion || ''}`,
          [{ text: 'OK' }]
        );
      } else if (error instanceof UserRejectedError) {
        Alert.alert('Connection Cancelled', error.recoverySuggestion || 'User rejected the connection request.');
      } else if (error.message?.includes('deep links are not supported in web browsers')) {
        Alert.alert(
          'Web Platform Not Supported',
          'TON Connect deep links only work on mobile devices (Android/iOS).\n\n' +
            'Please test this on:\n' +
            '• Android device/emulator\n' +
            '• iOS device/simulator\n\n' +
            'Web browsers cannot handle tonconnect:// protocol links.',
          [{ text: 'OK' }]
        );
      } else if (error.message?.includes('No TON wallet app found')) {
        Alert.alert(
          'Wallet Not Found',
          error.message +
            '\n\n' +
            'Available wallets:\n' +
            wallets.map((w) => `• ${w.name}`).join('\n'),
          [{ text: 'OK' }]
        );
      } else if (error.message?.includes('Connection request already in progress')) {
        Alert.alert(
          'Connection In Progress',
          'A connection request is already in progress. Please wait for it to complete or timeout.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Connection Error',
          `${error.message || 'Connection failed. Please try again.'}\n\n${error.recoverySuggestion || ''}`
        );
      }
    }
  };

  // NEW: Handle send transaction using Transaction Builder
  const handleSendTransaction = async () => {
    if (!wallet?.connected) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }

    try {
      // NEW: Use transaction builder utility
      const transaction = buildTransferTransaction(
        'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
        0.01 // 0.01 TON (will be converted to nanotons automatically)
      );

      const response = await tonConnectUI.sendTransaction(transaction);

      Alert.alert(
        'Transaction Sent',
        `Transaction sent successfully!\n\n` +
          `Amount: 0.01 TON\n` +
          `To: ${formatTonAddress('EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo')}\n\n` +
          `BOC: ${response.boc.substring(0, 20)}...\n` +
          `Signature: ${response.signature.substring(0, 20)}...`
      );
    } catch (error: any) {
      // NEW: Enhanced error handling
      if (error instanceof TransactionTimeoutError) {
        Alert.alert(
          'Transaction Timeout',
          `${error.message}\n\n${error.recoverySuggestion || ''}`
        );
      } else if (error instanceof UserRejectedError) {
        Alert.alert('Transaction Cancelled', error.recoverySuggestion || 'User rejected the transaction.');
      } else {
        Alert.alert(
          'Transaction Error',
          `${error.message || 'Transaction failed.'}\n\n${error.recoverySuggestion || ''}`
        );
      }
    }
  };

  // NEW: Test multi-transfer transaction
  const handleMultiTransfer = async () => {
    if (!wallet?.connected) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }

    try {
      // NEW: Use multi-transfer builder
      const transaction = buildMultiTransferTransaction([
        { to: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo', amount: 0.01 },
        { to: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo', amount: 0.02 },
      ]);

      const response = await tonConnectUI.sendTransaction(transaction);

      Alert.alert(
        'Multi-Transfer Sent',
        `Transaction with 2 recipients sent successfully!\n\n` +
          `BOC: ${response.boc.substring(0, 20)}...`
      );
    } catch (error: any) {
      if (error instanceof UserRejectedError) {
        Alert.alert('Transaction Cancelled', 'User rejected the transaction.');
      } else {
        Alert.alert('Transaction Error', error.message || 'Transaction failed.');
      }
    }
  };

  // Handle sign data (for authentication, etc.)
  const handleSignData = async () => {
    if (!wallet?.connected) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }

    try {
      const dataToSign = 'Hello, TON! This is a test message for signing.';
      const response = await tonConnectUI.signData({
        data: dataToSign,
        version: '1.0',
      });

      Alert.alert(
        'Data Signed',
        `Data signed successfully!\n\nSignature: ${response.signature.substring(0, 30)}...\nTimestamp: ${new Date(response.timestamp).toLocaleString()}`
      );
    } catch (error: any) {
      if (error.message?.includes('User rejected')) {
        Alert.alert('Sign Data Cancelled', 'User rejected the sign data request.');
      } else if (error.message?.includes('not support')) {
        Alert.alert(
          'Not Supported',
          'This wallet does not support signing arbitrary data. Try a different wallet.'
        );
      } else {
        Alert.alert('Sign Data Error', error.message || 'Sign data failed.');
      }
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      Alert.alert('Disconnected', 'Wallet disconnected successfully.');
      setBalance(null);
      setTxStatus(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Disconnect failed.');
    }
  };

  // NEW: Handle network switching
  const handleSwitchNetwork = () => {
    const currentNetwork = tonConnectUI.getNetwork();
    const newNetwork: Network = currentNetwork === 'mainnet' ? 'testnet' : 'mainnet';
    
    try {
      tonConnectUI.setNetwork(newNetwork);
      Alert.alert(
        'Network Switched',
        `Switched to ${newNetwork.toUpperCase()}\n\nChain ID: ${newNetwork === 'testnet' ? '-3' : '-239'}\n\nNote: If wallet is connected, you may need to reconnect.`
      );
      setBalance(null); // Clear balance when network changes
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to switch network.');
    }
  };

  // NEW: Handle balance checking
  const handleGetBalance = async () => {
    if (!wallet?.connected) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }

    setBalanceLoading(true);
    try {
      const balanceData = await tonConnectUI.getBalance();
      setBalance(balanceData);
      Alert.alert(
        'Balance Retrieved',
        `Network: ${balanceData.network.toUpperCase()}\n\nBalance: ${balanceData.balanceTon} TON\n\nNanotons: ${balanceData.balance}`
      );
    } catch (error: any) {
      Alert.alert('Balance Error', error.message || 'Failed to get balance.');
    } finally {
      setBalanceLoading(false);
    }
  };

  // NEW: Handle transaction status tracking
  const handleCheckTransactionStatus = () => {
    if (!wallet?.connected || !wallet.account) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }
    setShowTxStatusModal(true);
  };

  const handleCheckTxStatusSubmit = async () => {
    if (!wallet?.account) {
      return;
    }

    const txHash = txHashInput.trim();
    if (!txHash || txHash.length === 0) {
      Alert.alert('Error', 'Transaction hash is required.');
      return;
    }

    setShowTxStatusModal(false);
    try {
      const status = await tonConnectUI.getTransactionStatusByHash(txHash, wallet.account.address);
      setTxStatus(status);
      Alert.alert(
        'Transaction Status',
        `Status: ${status.status.toUpperCase()}\n\n` +
          (status.hash ? `Hash: ${status.hash.substring(0, 20)}...\n` : '') +
          (status.blockNumber ? `Block: ${status.blockNumber}\n` : '') +
          (status.error ? `Error: ${status.error}` : '')
      );
      setTxHashInput(''); // Clear input
    } catch (error: any) {
      Alert.alert('Status Error', error.message || 'Failed to check transaction status.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TON Connect Test</Text>
      <Text style={styles.subtitle}>React Integration Demo</Text>

      {/* Connection Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusText, wallet?.connected && styles.statusConnected]}>
          {wallet?.connected ? 'Connected' : 'Disconnected'}
        </Text>
      </View>

      {/* Wallet Info */}
      {wallet?.connected && wallet.account && (
        <View style={styles.walletInfo}>
          <Text style={styles.walletInfoTitle}>Wallet Information</Text>
          <Text style={styles.walletInfoText}>
            <Text style={styles.walletInfoLabel}>Wallet:</Text> {wallet.wallet?.name || 'Unknown'}
          </Text>
          <Text style={styles.walletInfoText}>
            <Text style={styles.walletInfoLabel}>Address:</Text>{' '}
            {formatTonAddress(wallet.account.address)}
          </Text>
          {wallet.account.publicKey && (
            <Text style={styles.walletInfoText}>
              <Text style={styles.walletInfoLabel}>Public Key:</Text>{' '}
              {wallet.account.publicKey.substring(0, 20)}...
            </Text>
          )}
          <Text style={styles.walletInfoText}>
            <Text style={styles.walletInfoLabel}>Chain:</Text> {wallet.account.chain}
          </Text>
          <Text style={styles.walletInfoText}>
            <Text style={styles.walletInfoLabel}>Network:</Text> {tonConnectUI.getNetwork().toUpperCase()}
          </Text>
          {balance && (
            <View style={styles.balanceContainer}>
              <Text style={styles.balanceTitle}>Balance</Text>
              <Text style={styles.balanceAmount}>{balance.balanceTon} TON</Text>
              <Text style={styles.balanceNetwork}>Network: {balance.network.toUpperCase()}</Text>
            </View>
          )}
          {txStatus && (
            <View style={styles.txStatusContainer}>
              <Text style={styles.txStatusTitle}>Last Transaction Status</Text>
              <Text style={styles.txStatusText}>
                Status: <Text style={styles.txStatusValue}>{txStatus.status.toUpperCase()}</Text>
              </Text>
              {txStatus.hash && (
                <Text style={styles.txStatusText}>
                  Hash: {txStatus.hash.substring(0, 20)}...
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      {/* NEW: Event Logs */}
      {eventLogs.length > 0 && (
        <View style={styles.eventLogsContainer}>
          <Text style={styles.eventLogsTitle}>Event Logs (Last 10)</Text>
          <ScrollView style={styles.eventLogsScroll} nestedScrollEnabled>
            {eventLogs.map((log, index) => (
              <Text key={index} style={styles.eventLogText}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        {!wallet?.connected ? (
          <>
            {/* Method 1: Using TonConnectButton component */}
            <View style={styles.buttonSection}>
              <Text style={styles.buttonSectionTitle}>Method 1: TonConnectButton</Text>
              <TonConnectButton
                text="Connect Wallet"
                connectedText="Disconnect"
                style={styles.connectButton}
                textStyle={styles.connectButtonText}
                onPress={() => {
                  // Open wallet selection modal when button is pressed
                  setShowWalletModal(true);
                }}
              />
            </View>

            {/* Method 2: Custom button with wallet selection */}
            <View style={styles.buttonSection}>
              <Text style={styles.buttonSectionTitle}>Method 2: Custom with Wallet Selection</Text>
              <Button
                title="Connect Wallet (Choose)"
                onPress={() => setShowWalletModal(true)}
                color="#0088cc"
              />
            </View>

            {/* NEW: Test Retry Feature */}
            <View style={styles.buttonSection}>
              <Text style={styles.buttonSectionTitle}>NEW: Retry Feature Test</Text>
              <Button
                title="Connect with Retry (3 attempts)"
                onPress={() => handleConnectWallet(undefined, true)}
                color="#9c27b0"
              />
              {retryCount > 0 && (
                <Text style={styles.retryInfo}>Retry attempt: {retryCount}</Text>
              )}
            </View>
          </>
        ) : (
          <>
            {/* NEW: Network & Balance Section */}
            <View style={styles.buttonSection}>
              <Text style={styles.buttonSectionTitle}>Network & Balance</Text>
              <Button
                title={`Switch to ${tonConnectUI.getNetwork() === 'mainnet' ? 'TESTNET' : 'MAINNET'}`}
                onPress={handleSwitchNetwork}
                color="#9c27b0"
              />
              <View style={styles.buttonSpacer} />
              <Button
                title={balanceLoading ? 'Loading Balance...' : 'Get Balance'}
                onPress={handleGetBalance}
                color="#4caf50"
                disabled={balanceLoading}
              />
            </View>

            <View style={styles.buttonSection}>
              <Text style={styles.buttonSectionTitle}>Transaction Tests</Text>
              <Button title="Send Transaction (Builder)" onPress={handleSendTransaction} color="#0088cc" />
              <View style={styles.buttonSpacer} />
              <Button title="Multi-Transfer (Builder)" onPress={handleMultiTransfer} color="#0088cc" />
              <View style={styles.buttonSpacer} />
              <Button
                title="Check Transaction Status"
                onPress={handleCheckTransactionStatus}
                color="#ff9800"
              />
            </View>
            <View style={styles.buttonSpacer} />
            <Button title="Sign Data" onPress={handleSignData} color="#0088cc" />
            <View style={styles.buttonSpacer} />
            <Button title="Disconnect" onPress={handleDisconnect} color="#ff4444" />
          </>
        )}
      </View>

      {/* Modal State Info */}
      {modal.open && (
        <View style={styles.modalStateInfo}>
          <Text style={styles.modalStateText}>Modal is open</Text>
        </View>
      )}

      {/* Wallet Selection Modal */}
      <Modal
        visible={showWalletModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowWalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Connect your TON wallet</Text>
              <Text style={styles.modalSubtitle}>Choose a wallet to connect</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowWalletModal(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.walletList}>
              <Text style={styles.availableWalletsText}>Available wallets</Text>
              {wallets.map((walletOption) => {
                const isAvailable = walletAvailability[walletOption.name] !== false;
                return (
                  <TouchableOpacity
                    key={walletOption.name}
                    style={[styles.walletItem, !isAvailable && styles.walletItemUnavailable]}
                    onPress={() => handleConnectWallet(walletOption.name, false)}
                  >
                    <View style={styles.walletIcon}>
                      <Text style={styles.walletIconText}>{walletOption.name.charAt(0)}</Text>
                    </View>
                    <View style={styles.walletItemInfo}>
                      <Text style={styles.walletName}>{walletOption.name}</Text>
                      <Text style={styles.walletAppName}>{walletOption.appName}</Text>
                      {walletAvailability[walletOption.name] !== undefined && (
                        <Text style={styles.walletAvailability}>
                          {isAvailable ? '✓ Available' : '✗ Not available on this platform'}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* NEW: Transaction Status Modal */}
      <Modal
        visible={showTxStatusModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowTxStatusModal(false);
          setTxHashInput('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Check Transaction Status</Text>
              <Text style={styles.modalSubtitle}>Enter transaction hash</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowTxStatusModal(false);
                  setTxHashInput('');
                }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.txStatusInputContainer}>
              <TextInput
                style={styles.txStatusInput}
                placeholder="Transaction hash..."
                placeholderTextColor="#999"
                value={txHashInput}
                onChangeText={setTxHashInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.txStatusButtons}>
                <TouchableOpacity
                  style={[styles.txStatusButton, styles.txStatusButtonCancel]}
                  onPress={() => {
                    setShowTxStatusModal(false);
                    setTxHashInput('');
                  }}
                >
                  <Text style={styles.txStatusButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.txStatusButton, styles.txStatusButtonCheck]}
                  onPress={handleCheckTxStatusSubmit}
                >
                  <Text style={styles.txStatusButtonText}>Check</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#000',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
    color: '#000',
  },
  statusText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '600',
  },
  statusConnected: {
    color: '#00aa00',
  },
  walletInfo: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  walletInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  walletInfoText: {
    fontSize: 14,
    marginBottom: 5,
    color: '#333',
  },
  walletInfoLabel: {
    fontWeight: '600',
    color: '#000',
  },
  buttonsContainer: {
    marginTop: 20,
  },
  buttonSection: {
    marginBottom: 20,
  },
  buttonSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  connectButton: {
    backgroundColor: '#0088cc',
  },
  connectButtonText: {
    color: '#ffffff',
  },
  buttonSpacer: {
    height: 10,
  },
  modalStateInfo: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ffc107',
  },
  modalStateText: {
    color: '#856404',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    position: 'relative',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#999',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  walletList: {
    padding: 20,
  },
  availableWalletsText: {
    fontSize: 14,
    color: '#999',
    marginBottom: 15,
  },
  walletItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 10,
  },
  walletIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  walletIconText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  walletItemInfo: {
    flex: 1,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  walletAppName: {
    fontSize: 12,
    color: '#999',
  },
  walletAvailability: {
    fontSize: 11,
    color: '#4caf50',
    marginTop: 4,
    fontWeight: '500',
  },
  walletItemUnavailable: {
    opacity: 0.6,
  },
  retryInfo: {
    fontSize: 12,
    color: '#9c27b0',
    marginTop: 5,
    textAlign: 'center',
    fontWeight: '500',
  },
  balanceContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#90caf9',
  },
  balanceTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976d2',
    marginBottom: 5,
  },
  balanceAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 3,
  },
  balanceNetwork: {
    fontSize: 11,
    color: '#64b5f6',
  },
  txStatusContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffb74d',
  },
  txStatusTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e65100',
    marginBottom: 5,
  },
  txStatusText: {
    fontSize: 12,
    color: '#e65100',
    marginBottom: 3,
  },
  txStatusValue: {
    fontWeight: 'bold',
  },
  eventLogsContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    maxHeight: 150,
  },
  eventLogsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 10,
  },
  eventLogsScroll: {
    maxHeight: 120,
  },
  eventLogText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 3,
    fontFamily: 'monospace',
  },
  txStatusInputContainer: {
    padding: 20,
  },
  txStatusInput: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    borderRadius: 8,
    padding: 15,
    fontSize: 14,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#444',
  },
  txStatusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  txStatusButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  txStatusButtonCancel: {
    backgroundColor: '#444',
  },
  txStatusButtonCheck: {
    backgroundColor: '#0088cc',
  },
  txStatusButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
