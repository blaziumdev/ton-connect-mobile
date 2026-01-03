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

  // Load supported wallets on mount
  React.useEffect(() => {
    const supportedWallets = sdk.getSupportedWallets();
    setWallets(supportedWallets);
  }, [sdk]);

  // Handle wallet selection and connection
  const handleConnectWallet = async (walletName?: string) => {
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

      // Connect to wallet (modal is already handled by TonConnectButton or custom UI)
      await tonConnectUI.connectWallet();

      // Success will be handled by status change callback
    } catch (error: any) {
      console.error('Connection error:', error);
      setShowWalletModal(false);

      // Handle specific error types
      if (error.message?.includes('deep links are not supported in web browsers')) {
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
      } else if (error.message?.includes('User rejected')) {
        Alert.alert('Connection Cancelled', 'User rejected the connection request.');
      } else {
        Alert.alert('Connection Error', error.message || 'Connection failed. Please try again.');
      }
    }
  };

  // Handle send transaction
  const handleSendTransaction = async () => {
    if (!wallet?.connected) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }

    try {
      const response = await tonConnectUI.sendTransaction({
        validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
        messages: [
          {
            address: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
            amount: '10000000', // 0.01 TON
          },
        ],
      });

      Alert.alert(
        'Transaction Sent',
        `Transaction sent successfully!\n\nBOC: ${response.boc.substring(0, 20)}...\nSignature: ${response.signature.substring(0, 20)}...`
      );
    } catch (error: any) {
      if (error.message?.includes('User rejected')) {
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
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Disconnect failed.');
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
            <Text style={styles.walletInfoLabel}>Address:</Text> {wallet.account.address}
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
          </>
        ) : (
          <>
            <Button title="Send Transaction" onPress={handleSendTransaction} color="#0088cc" />
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
              {wallets.map((walletOption) => (
                <TouchableOpacity
                  key={walletOption.name}
                  style={styles.walletItem}
                  onPress={() => handleConnectWallet(walletOption.name)}
                >
                  <View style={styles.walletIcon}>
                    <Text style={styles.walletIconText}>{walletOption.name.charAt(0)}</Text>
                  </View>
                  <View style={styles.walletItemInfo}>
                    <Text style={styles.walletName}>{walletOption.name}</Text>
                    <Text style={styles.walletAppName}>{walletOption.appName}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
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
});
