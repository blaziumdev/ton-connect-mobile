/**
 * WalletSelectionModal component
 * Provides a beautiful wallet selection UI compatible with @tonconnect/ui-react
 * Matches the exact UI/UX of @tonconnect/ui-react wallet selection modal
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useTonConnectUI, useTonConnectSDK } from './index';
import type { WalletDefinition } from '../index';

export interface WalletSelectionModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Custom wallet list (optional, uses SDK's supported wallets by default) */
  wallets?: WalletDefinition[];
  /** Custom styles */
  style?: any;
}

/**
 * WalletSelectionModal - Beautiful wallet selection modal
 * Compatible with @tonconnect/ui-react modal behavior
 */
export function WalletSelectionModal({
  visible,
  onClose,
  wallets: customWallets,
  style,
}: WalletSelectionModalProps): JSX.Element {
  const tonConnectUI = useTonConnectUI();
  const sdk = useTonConnectSDK();
  const [wallets, setWallets] = React.useState<WalletDefinition[]>([]);
  const [connectingWallet, setConnectingWallet] = React.useState<string | null>(null);
  const [walletAvailability, setWalletAvailability] = React.useState<Record<string, boolean>>({});

  // Load wallets and check availability
  React.useEffect(() => {
    const loadWallets = async () => {
      if (customWallets) {
        setWallets(customWallets);
      } else {
        const supportedWallets = sdk.getSupportedWallets();
        // Show all wallets (like @tonconnect/ui-react does)
        // Availability will be checked and displayed
        setWallets(supportedWallets);
      }

      // Check availability for all wallets
      const availability: Record<string, boolean> = {};
      const walletsToCheck = customWallets || sdk.getSupportedWallets();
      for (const wallet of walletsToCheck) {
        try {
          const isAvailable = await sdk.isWalletAvailable(wallet.name);
          availability[wallet.name] = isAvailable;
        } catch (error) {
          availability[wallet.name] = false;
        }
      }
      setWalletAvailability(availability);
    };

    if (visible) {
      loadWallets();
    }
  }, [sdk, customWallets, visible]);

  // Handle wallet selection
  const handleSelectWallet = async (wallet: WalletDefinition) => {
    // Prevent multiple simultaneous connection attempts
    if (connectingWallet) {
      return;
    }

    try {
      setConnectingWallet(wallet.name);
      
      // Set preferred wallet
      try {
        sdk.setPreferredWallet(wallet.name);
      } catch (error) {
        console.error('[WalletSelectionModal] Failed to set preferred wallet:', error);
        // Continue anyway - SDK will use default wallet
      }
      
      // Close modal
      onClose();
      
      // Small delay to ensure modal closes
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 100));
      
      // Connect
      await tonConnectUI.connectWallet();
    } catch (error) {
      console.error('[WalletSelectionModal] Wallet connection error:', error);
      setConnectingWallet(null);
      // Error is handled by SDK/UI, just reset connecting state
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, style]}>
        <View style={styles.modalContainer}>
          {/* Header - matches @tonconnect/ui-react style */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={onClose}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Wallets</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Wallet Grid - matches @tonconnect/ui-react grid layout */}
          <ScrollView 
            style={styles.walletList} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.walletGrid}
          >
            {wallets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No wallets available</Text>
                <Text style={styles.emptyStateSubtext}>
                  Please install a TON wallet app to continue
                </Text>
              </View>
            ) : (
              wallets.map((wallet) => {
                const isConnecting = connectingWallet === wallet.name;
                const isAvailable = walletAvailability[wallet.name] !== false;
                return (
                  <TouchableOpacity
                    key={wallet.name}
                    style={[
                      styles.walletCard,
                      !isAvailable && styles.walletCardUnavailable,
                      isConnecting && styles.walletCardConnecting,
                    ]}
                    onPress={() => isAvailable && !isConnecting && handleSelectWallet(wallet)}
                    disabled={!isAvailable || isConnecting}
                  >
                    <View style={styles.walletIconContainer}>
                      {wallet.iconUrl && Platform.OS !== 'web' ? (
                        <Image
                          source={{ uri: wallet.iconUrl }}
                          style={styles.walletIcon}
                          onError={() => {
                            // Fallback to placeholder on error
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.walletIconPlaceholder}>
                          <Text style={styles.walletIconText}>
                            {wallet.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.walletName} numberOfLines={1}>
                      {wallet.name}
                    </Text>
                    {isConnecting && (
                      <ActivityIndicator 
                        size="small" 
                        color="#0088cc" 
                        style={styles.connectingSpinner}
                      />
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          {/* Footer - matches @tonconnect/ui-react footer */}
          <View style={styles.footer}>
            <View style={styles.footerContent}>
              <View style={styles.tonConnectLogo}>
                <Text style={styles.tonConnectLogoText}>TON</Text>
              </View>
              <Text style={styles.footerText}>TON Connect</Text>
            </View>
            <TouchableOpacity style={styles.helpButton}>
              <Text style={styles.helpButtonText}>?</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  walletList: {
    flex: 1,
  },
  walletGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    justifyContent: 'flex-start',
  },
  walletCard: {
    width: '25%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginBottom: 16,
  },
  walletCardUnavailable: {
    opacity: 0.5,
  },
  walletCardConnecting: {
    opacity: 0.7,
  },
  walletIconContainer: {
    width: 64,
    height: 64,
    marginBottom: 8,
  },
  walletIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  walletIconPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  walletIconText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  walletName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
    textAlign: 'center',
    maxWidth: '100%',
  },
  connectingSpinner: {
    marginTop: 4,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    width: '100%',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tonConnectLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#0088cc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tonConnectLogoText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  footerText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  helpButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButtonText: {
    color: '#999999',
    fontSize: 14,
    fontWeight: '600',
  },
});

