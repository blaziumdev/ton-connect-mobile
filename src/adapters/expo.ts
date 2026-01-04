/**
 * Expo platform adapter
 * Handles deep linking, storage, and crypto for Expo environments
 */

// Type declarations for runtime globals
declare const require: {
  (id: string): any;
};

import { PlatformAdapter } from '../types';

// Dynamic imports to handle optional dependencies
let Linking: any;
let Crypto: any;
let AsyncStorage: any;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Linking = require('expo-linking');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  Crypto = require('expo-crypto');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  // Dependencies not available
}

/**
 * Expo platform adapter implementation
 */
export class ExpoAdapter implements PlatformAdapter {
  private urlListeners: Array<(url: string) => void> = [];
  private subscription: { remove: () => void } | null = null;

  constructor() {
    // Set up URL listener
    this.setupURLListener();
  }

  private setupURLListener(): void {
    if (!Linking) {
      console.warn('[ExpoAdapter] Linking not available, URL listener not set up');
      return;
    }
    // Listen for deep links when app is already open
    this.subscription = Linking.addEventListener('url', (event: { url: string }) => {
      console.log('[ExpoAdapter] URL event received:', event.url);
      this.urlListeners.forEach((listener) => {
        try {
          listener(event.url);
        } catch (error) {
          console.error('[ExpoAdapter] Error in URL listener:', error);
        }
      });
    });
    console.log('[ExpoAdapter] URL listener set up successfully');
  }

  async openURL(url: string, skipCanOpenURLCheck: boolean = true): Promise<boolean> {
    if (!Linking) {
      throw new Error('expo-linking is not available');
    }
    try {
      console.log('[ExpoAdapter] Opening URL:', url);
      
      // Optional canOpenURL check (can be disabled via config)
      if (!skipCanOpenURLCheck) {
        console.log('[ExpoAdapter] Checking if URL can be opened...');
        const canOpen = await Linking.canOpenURL(url);
        console.log('[ExpoAdapter] canOpenURL result:', canOpen);
        if (!canOpen) {
          throw new Error(
            'Cannot open URL. Make sure a wallet app is installed that supports tonconnect:// protocol.'
          );
        }
      } else {
        console.log('[ExpoAdapter] Skipping canOpenURL check (Android compatibility)');
      }
      
      // CRITICAL FIX: On Android, canOpenURL() may not recognize tonconnect:// protocol
      // So we call openURL() directly. If it fails, it will throw an error.
      await Linking.openURL(url);
      console.log('[ExpoAdapter] URL opened successfully');
      return true;
    } catch (error: any) {
      console.error('[ExpoAdapter] Error in openURL:', error);
      // On Android, if tonconnect:// protocol is not recognized or wallet is not installed, it will throw an error
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('No Activity found') || errorMessage.includes('No app found') || errorMessage.includes('Cannot open URL')) {
        throw new Error(
          'No TON wallet app found. Please install Tonkeeper or another TON Connect compatible wallet from Google Play Store.'
        );
      }
      throw new Error(`Failed to open wallet app: ${errorMessage}`);
    }
  }

  async getInitialURL(): Promise<string | null> {
    if (!Linking) {
      console.warn('[ExpoAdapter] Linking not available, cannot get initial URL');
      return null;
    }
    try {
      const url = await Linking.getInitialURL();
      console.log('[ExpoAdapter] getInitialURL result:', url);
      return url;
    } catch (error) {
      console.error('[ExpoAdapter] Error getting initial URL:', error);
      return null;
    }
  }

  addURLListener(callback: (url: string) => void): () => void {
    this.urlListeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.urlListeners.indexOf(callback);
      if (index > -1) {
        this.urlListeners.splice(index, 1);
      }
    };
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!AsyncStorage) {
      throw new Error('@react-native-async-storage/async-storage is not available');
    }
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error: any) {
      throw new Error(`Failed to set storage item: ${error?.message || error}`);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (!AsyncStorage) {
      return null;
    }
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!AsyncStorage) {
      return;
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      // Ignore errors on remove
    }
  }

  async randomBytes(length: number): Promise<Uint8Array> {
    if (Crypto) {
      try {
        // Use expo-crypto for random bytes
        const randomString = await Crypto.getRandomBytesAsync(length);
        return randomString;
      } catch (error) {
        // Fall through to crypto.getRandomValues check
      }
    }
    
    // HIGH FIX: Try crypto.getRandomValues as fallback
    // eslint-disable-next-line no-undef
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis as any).crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      (globalThis as any).crypto.getRandomValues(bytes);
      return bytes;
    }
    
    // HIGH FIX: Throw error instead of using insecure Math.random()
    throw new Error(
      'Cryptographically secure random number generation not available. ' +
      'Please ensure expo-crypto is installed or use react-native-get-random-values'
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.urlListeners = [];
  }
}

