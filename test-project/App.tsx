/**
 * Test project for @blazium/ton-connect-mobile
 */

// IMPORTANT: Import react-native-get-random-values first
import 'react-native-get-random-values';

import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { TonConnectMobile, ConnectionStatus } from '@blazium/ton-connect-mobile';

// Initialize SDK
const ton = new TonConnectMobile({
  manifestUrl: 'https://example.com/tonconnect-manifest.json',
  scheme: 'testapp',
});

export default function App() {
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false, wallet: null });

  useEffect(() => {
    // Subscribe to status changes
    const unsubscribe = ton.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Load initial status
    setStatus(ton.getStatus());

    return () => {
      unsubscribe();
    };
  }, []);

  const handleConnect = async () => {
    try {
      const wallet = await ton.connect();
      Alert.alert('Connected', `Connected to ${wallet.name}\nAddress: ${wallet.address}`);
    } catch (error: any) {
      // Check if it's a web platform error
      if (error.message && error.message.includes('deep links are not supported in web browsers')) {
        Alert.alert(
          'Web Platform Not Supported',
          'TON Connect deep links only work on mobile devices (Android/iOS).\n\n' +
          'Please test this on:\n' +
          '• Android device/emulator\n' +
          '• iOS device/simulator\n\n' +
          'Web browsers cannot handle tonconnect:// protocol links.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', error.message || 'Connection failed');
      }
    }
  };

  const handleSendTransaction = async () => {
    try {
      const response = await ton.sendTransaction({
        validUntil: Date.now() + 5 * 60 * 1000,
        messages: [
          {
            address: 'EQD0vdSA_NedR9uvbgN9EikRX-suesDxGeFg69XQMavfLqIo',
            amount: '10000000',
          },
        ],
      });
      Alert.alert('Success', 'Transaction sent successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Transaction failed');
    }
  };

  const handleDisconnect = async () => {
    try {
      await ton.disconnect();
      Alert.alert('Disconnected', 'Wallet disconnected');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Disconnect failed');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TON Connect Test</Text>
      <Text style={styles.status}>
        Status: {status.connected ? 'Connected' : 'Disconnected'}
      </Text>
      {status.wallet && (
        <View style={styles.walletInfo}>
          <Text>Wallet: {status.wallet.name}</Text>
          <Text>Address: {status.wallet.address}</Text>
        </View>
      )}
      <View style={styles.buttons}>
        {!status.connected ? (
          <Button title="Connect Wallet" onPress={handleConnect} />
        ) : (
          <>
            <Button title="Send Transaction" onPress={handleSendTransaction} />
            <Button title="Disconnect" onPress={handleDisconnect} />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  status: {
    fontSize: 18,
    marginBottom: 20,
  },
  walletInfo: {
    marginBottom: 20,
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  buttons: {
    gap: 10,
  },
});

