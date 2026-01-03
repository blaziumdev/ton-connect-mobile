/**
 * TonConnectButton component
 * Compatible with @tonconnect/ui-react TonConnectButton
 */

import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTonConnectUI, useTonWallet } from './index';

export interface TonConnectButtonProps {
  /** Button text when disconnected */
  text?: string;
  /** Button text when connected */
  connectedText?: string;
  /** Custom styles */
  style?: ViewStyle;
  /** Custom text styles */
  textStyle?: TextStyle;
  /** Callback when button is pressed */
  onPress?: () => void;
}

/**
 * TonConnectButton - Button component for connecting/disconnecting wallet
 * Compatible with @tonconnect/ui-react TonConnectButton
 */
export function TonConnectButton({
  text = 'Connect Wallet',
  connectedText = 'Disconnect',
  style,
  textStyle,
  onPress,
}: TonConnectButtonProps): JSX.Element {
  const tonConnectUI = useTonConnectUI();
  const wallet = useTonWallet();
  const isConnected = wallet?.connected || false;
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    // CRITICAL FIX: Prevent multiple simultaneous presses
    if (isLoading) {
      return;
    }

    if (onPress) {
      onPress();
      return;
    }

    setIsLoading(true);
    try {
      if (isConnected) {
        await tonConnectUI.disconnect();
      } else {
        // CRITICAL FIX: Only open modal, don't auto-connect
        // The modal should handle wallet selection and connection
        // This allows users to choose which wallet to connect
        await tonConnectUI.openModal();
        // Note: connectWallet() should be called by the modal/wallet selection UI
        // Not automatically here, to allow wallet selection
      }
    } catch (error) {
      // CRITICAL FIX: Handle errors gracefully
      console.error('TonConnectButton error:', error);
      // Error is already handled by the SDK/UI, just reset loading state
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, style, isLoading && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isLoading}
    >
      {isLoading ? (
        <ActivityIndicator color="#ffffff" />
      ) : (
        <Text style={[styles.buttonText, textStyle]}>
          {isConnected ? connectedText : text}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#0088cc',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

