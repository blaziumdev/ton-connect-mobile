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
      return;
    }
    // Listen for deep links when app is already open
    this.subscription = Linking.addEventListener('url', (event: { url: string }) => {
      this.urlListeners.forEach((listener) => listener(event.url));
    });
  }

  async openURL(url: string): Promise<boolean> {
    if (!Linking) {
      throw new Error('expo-linking is not available');
    }
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        return false;
      }
      await Linking.openURL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getInitialURL(): Promise<string | null> {
    if (!Linking) {
      return null;
    }
    try {
      return await Linking.getInitialURL();
    } catch (error) {
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

