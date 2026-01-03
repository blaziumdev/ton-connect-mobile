/**
 * Web platform adapter
 * Handles deep linking and storage for web environments
 */

// Type declarations for browser APIs
declare const window: {
  location: {
    href: string;
  };
  open(url: string, target?: string): any;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  alert(message: string): void;
  localStorage: {
    setItem(key: string, value: string): void;
    getItem(key: string): string | null;
    removeItem(key: string): void;
  };
  crypto: {
    getRandomValues(array: Uint8Array): Uint8Array;
  };
} | undefined;

import { PlatformAdapter } from '../types';

/**
 * Web platform adapter implementation
 * Uses browser APIs for deep linking and localStorage for storage
 */
export class WebAdapter implements PlatformAdapter {
  private urlListeners: Array<(url: string) => void> = [];
  private isListening = false;

  constructor() {
    // Set up URL listener
    this.setupURLListener();
  }

  private setupURLListener(): void {
    // Listen for hash changes (web deep links)
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.handleURLChange();
      });
      
      // Also check on popstate (browser back/forward)
      window.addEventListener('popstate', () => {
        this.handleURLChange();
      });
      
      this.isListening = true;
    }
  }

  private handleURLChange(): void {
    if (typeof window === 'undefined') return;
    
    const url = window.location.href;
    this.urlListeners.forEach((listener) => {
      try {
        listener(url);
      } catch (error) {
        // Ignore errors in listeners
      }
    });
  }

  async openURL(url: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined') {
        // For web, tonconnect:// deep links don't work
        // They only work on mobile devices (Android/iOS)
        if (url.startsWith('tonconnect://')) {
          // Show user-friendly error message
          const errorMessage = 
            'TON Connect deep links only work on mobile devices (Android/iOS).\n\n' +
            'Please test this on a mobile device or use the mobile app.\n\n' +
            'Deep link: ' + url.substring(0, 100) + '...';
          
          // Try to show alert (if available)
          if (typeof window.alert !== 'undefined') {
            window.alert(errorMessage);
          } else {
            console.error('TON Connect Web Error:', errorMessage);
          }
          
          // Throw error so SDK can handle it properly
          throw new Error(
            'TON Connect deep links are not supported in web browsers. ' +
            'Please use this SDK on a mobile device (Android/iOS) or test with a mobile app.'
          );
        } else {
          // Regular HTTP/HTTPS URLs work fine
          window.location.href = url;
          return true;
        }
      }
      return false;
    } catch (error) {
      // Re-throw the error so SDK can handle it
      throw error;
    }
  }

  async getInitialURL(): Promise<string | null> {
    if (typeof window !== 'undefined') {
      return window.location.href;
    }
    return null;
  }

  addURLListener(callback: (url: string) => void): () => void {
    this.urlListeners.push(callback);
    
    // Immediately check current URL
    if (typeof window !== 'undefined') {
      try {
        callback(window.location.href);
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Return unsubscribe function
    return () => {
      const index = this.urlListeners.indexOf(callback);
      if (index > -1) {
        this.urlListeners.splice(index, 1);
      }
    };
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      throw new Error('localStorage is not available');
    }
    try {
      window.localStorage.setItem(key, value);
    } catch (error: any) {
      throw new Error(`Failed to set storage item: ${error?.message || error}`);
    }
  }

  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      // Ignore errors on remove
    }
  }

  async randomBytes(length: number): Promise<Uint8Array> {
    // Use crypto.getRandomValues (available in modern browsers)
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return bytes;
    }
    
    // Fallback: should not happen in modern browsers
    throw new Error(
      'Cryptographically secure random number generation not available. ' +
      'Please use a modern browser with crypto.getRandomValues support.'
    );
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.urlListeners = [];
    this.isListening = false;
  }
}

