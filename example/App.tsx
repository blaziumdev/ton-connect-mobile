/**
 * Example Expo app demonstrating TON Connect Mobile SDK
 */

// IMPORTANT: Import react-native-get-random-values at the very top
import 'react-native-get-random-values';

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
// In development, import from source
// In production, this would be: import { TonConnectMobile, ConnectionStatus } from '@blazium/ton-connect-mobile';
import { TonConnectMobile, ConnectionStatus } from '../src/index';

// Initialize SDK
const ton = new TonConnectMobile({
  manifestUrl: 'https://example.com/tonconnect-manifest.json',
  scheme: 'tonconnectexample', // Must match app.json scheme
});

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false, wallet: null });
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = ton.onStatusChange((newStatus) => {
      setStatus(newStatus);
      addLog(`Status changed: ${newStatus.connected ? 'Connected' : 'Disconnected'}`);
      if (newStatus.wallet) {
        addLog(`Wallet: ${newStatus.wallet.name} (${newStatus.wallet.address})`);
      }
    });

    // Load initial status
    setStatus(ton.getStatus());

    return () => {
      unsubscribe();
    };
  }, []);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]);
  };

  const handleConnect = async () => {
    if (status.connected) {
      Alert.alert('Already Connected', 'You are already connected to a wallet.');
      return;
    }

    setConnecting(true);
    addLog('Initiating connection...');

    try {
      const wallet = await ton.connect();
      addLog(`Connected to ${wallet.name}`);
      Alert.alert('Connected', `Connected to ${wallet.name}\nAddress: ${wallet.address}`);
    } catch (error: any) {
      addLog(`Connection failed: ${error.message}`);
      Alert.alert('Connection Failed', error.message || 'Unknown error');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await ton.disconnect();
      addLog('Disconnected');
      Alert.alert('Disconnected', 'You have been disconnected from the wallet.');
    } catch (error: any) {
      addLog(`Disconnect failed: ${error.message}`);
      Alert.alert('Error', error.message || 'Unknown error');
    }
  };

  const handleSendTransaction = async () => {
    if (!status.connected || !status.wallet) {
      Alert.alert('Not Connected', 'Please connect to a wallet first.');
      return;
    }

    setSending(true);
    addLog('Sending transaction request...');

    try {
      // Example transaction: send 0.01 TON to a test address
      const response = await ton.sendTransaction({
        validUntil: Date.now() + 5 * 60 * 1000, // 5 minutes
        messages: [
          {
            address: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo', // Example address
            amount: '10000000', // 0.01 TON in nanotons
          },
        ],
      });

      addLog(`Transaction sent! BOC: ${response.boc.substring(0, 20)}...`);
      Alert.alert(
        'Transaction Sent',
        `Transaction has been signed by the wallet.\nSignature: ${response.signature.substring(0, 20)}...`
      );
    } catch (error: any) {
      addLog(`Transaction failed: ${error.message}`);
      Alert.alert('Transaction Failed', error.message || 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>TON Connect Mobile SDK</Text>
        <Text style={styles.subtitle}>Example App</Text>

        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Status:</Text>
          <View style={[styles.statusIndicator, status.connected && styles.statusConnected]} />
          <Text style={styles.statusText}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>

        {status.wallet && (
          <View style={styles.walletInfo}>
            <Text style={styles.walletTitle}>Wallet Information</Text>
            <Text style={styles.walletText}>Name: {status.wallet.name}</Text>
            <Text style={styles.walletText}>App: {status.wallet.appName}</Text>
            <Text style={styles.walletText}>Version: {status.wallet.version}</Text>
            <Text style={styles.walletText}>Platform: {status.wallet.platform}</Text>
            <Text style={styles.walletText} numberOfLines={1} ellipsizeMode="middle">
              Address: {status.wallet.address}
            </Text>
            <Text style={styles.walletText} numberOfLines={1} ellipsizeMode="middle">
              Public Key: {status.wallet.publicKey.substring(0, 20)}...
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!status.connected ? (
            <TouchableOpacity
              style={[styles.button, styles.connectButton, connecting && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Connect Wallet</Text>
              )}
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.transactionButton, sending && styles.buttonDisabled]}
                onPress={handleSendTransaction}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Transaction</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.disconnectButton]}
                onPress={handleDisconnect}
              >
                <Text style={styles.buttonText}>Disconnect</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.logsContainer}>
          <Text style={styles.logsTitle}>Logs</Text>
          <ScrollView style={styles.logsScroll}>
            {logs.length === 0 ? (
              <Text style={styles.logText}>No logs yet...</Text>
            ) : (
              logs.map((log, index) => (
                <Text key={index} style={styles.logText}>
                  {log}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 10,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
    marginRight: 10,
  },
  statusConnected: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    fontSize: 16,
    color: '#333',
  },
  walletInfo: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  walletTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  walletText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    minHeight: 50,
  },
  connectButton: {
    backgroundColor: '#0088cc',
  },
  transactionButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#f44336',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logsContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    height: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  logsScroll: {
    flex: 1,
  },
  logText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 5,
  },
});

