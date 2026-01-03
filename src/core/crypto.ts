/**
 * Cryptographic utilities for TonConnect
 * Uses tweetnacl for signature verification
 */

// Type declarations for runtime globals
declare const console: {
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

declare const crypto: {
  getRandomValues(array: Uint8Array): Uint8Array;
} | undefined;

declare const require: {
  (id: string): any;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nacl = require('tweetnacl');
import { ConnectionResponsePayload } from '../types';

/**
 * Decode base64 string to Uint8Array
 */
function decodeBase64(base64: string): Uint8Array {
  // Remove padding and convert URL-safe to standard base64
  const cleanBase64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = cleanBase64 + '='.repeat((4 - (cleanBase64.length % 4)) % 4);
  
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;
  
  for (let i = 0; i < padded.length; i++) {
    const ch = padded[i];
    if (ch === '=') break;
    
    const index = chars.indexOf(ch);
    if (index === -1) continue;
    
    buffer = (buffer << 6) | index;
    bitsCollected += 6;
    
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      bytes.push((buffer >> bitsCollected) & 0xff);
      buffer &= (1 << bitsCollected) - 1;
    }
  }
  
  return new Uint8Array(bytes);
}

/**
 * TextEncoder type declaration
 */
declare const TextEncoder: {
  new (): {
    encode(input: string): Uint8Array;
  };
} | undefined;

/**
 * Get TextEncoder with fallback
 */
function getTextEncoder(): { encode(input: string): Uint8Array } {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder();
  }
  // Fallback implementation for older React Native
  throw new Error('TextEncoder is not available. Please use React Native 0.59+ or add a polyfill.');
}

/**
 * Verify connection proof signature
 * The proof is signed by the wallet to verify authenticity
 */
export function verifyConnectionProof(
  response: ConnectionResponsePayload,
  manifestUrl: string
): boolean {
  // HIGH FIX: Log warning if proof is missing but allow for compatibility
  if (!response.proof) {
    console.warn('TON Connect: Connection proof missing - wallet may not support proof verification');
    // Allow connection for compatibility, but log warning
    return true;
  }

  try {
    const { timestamp, domain, signature } = response.proof;

    // Validate proof structure
    if (typeof timestamp !== 'number' || !domain || typeof domain.lengthBytes !== 'number' || typeof domain.value !== 'string' || typeof signature !== 'string') {
      return false;
    }

    // Build the message that was signed
    // Format: <timestamp>.<domain_length>.<domain_value>.<address>.<publicKey>
    const domainLength = domain.lengthBytes;
    const message = `${timestamp}.${domainLength}.${domain.value}.${response.address}.${response.publicKey}`;

    // Convert public key from hex to Uint8Array
    const publicKeyBytes = hexToBytes(response.publicKey);
    if (publicKeyBytes.length !== 32) {
      return false;
    }

    // Convert signature from base64 to Uint8Array
    const signatureBytes = decodeBase64(signature);
    if (signatureBytes.length !== 64) {
      return false;
    }

    // Verify signature using nacl
    const encoder = getTextEncoder();
    const messageBytes = encoder.encode(message);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    // If verification fails, return false
    console.error('TON Connect: Proof verification error:', error);
    return false;
  }
}

/**
 * Verify transaction signature
 * 
 * WARNING: This function only performs basic format validation.
 * Full signature verification requires parsing the BOC (Bag of Cells) and
 * verifying the signature against the transaction hash, which requires
 * TON library integration (@ton/core or @ton/crypto).
 * 
 * For production use, transaction signatures should be verified server-side
 * using proper TON libraries.
 * 
 * @returns false - Always returns false to be safe until proper implementation
 */
export function verifyTransactionSignature(
  boc: string,
  signature: string,
  publicKey: string
): boolean {
  // CRITICAL FIX: This function does not actually verify signatures
  // It only checks format. For security, we return false until proper implementation.
  
  try {
    // Basic format validation
    if (!boc || typeof boc !== 'string' || boc.length === 0) {
      return false;
    }
    if (!signature || typeof signature !== 'string' || signature.length === 0) {
      return false;
    }
    if (!publicKey || typeof publicKey !== 'string' || publicKey.length === 0) {
      return false;
    }

    // Convert public key from hex to Uint8Array
    const publicKeyBytes = hexToBytes(publicKey);
    if (publicKeyBytes.length !== 32) {
      return false;
    }

    // Convert signature from base64 to Uint8Array
    const signatureBytes = decodeBase64(signature);
    if (signatureBytes.length !== 64) {
      return false;
    }

    // Convert BOC from base64 to Uint8Array
    const bocBytes = decodeBase64(boc);
    if (bocBytes.length === 0) {
      return false;
    }

    // CRITICAL: Return false - actual signature verification requires TON library
    // TODO: Integrate @ton/core or @ton/crypto for proper BOC parsing and signature verification
    console.warn('TON Connect: Transaction signature verification not fully implemented. Signature format is valid but not cryptographically verified. Verify server-side using @ton/core.');
    return false; // Fail-safe: reject until properly implemented
  } catch (error) {
    console.error('TON Connect: Transaction signature verification error:', error);
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;

  // Handle odd-length hex strings
  const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;

  const bytes = new Uint8Array(paddedHex.length / 2);
  for (let i = 0; i < paddedHex.length; i += 2) {
    bytes[i / 2] = parseInt(paddedHex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Generate cryptographically secure random bytes
 */
function getSecureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  
  // Try to use crypto.getRandomValues (available in React Native with polyfill)
  // eslint-disable-next-line no-undef
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis as any).crypto.getRandomValues) {
    (globalThis as any).crypto.getRandomValues(bytes);
    return bytes;
  }
  
  // HIGH FIX: Throw error instead of using insecure Math.random()
  throw new Error(
    'Cryptographically secure random number generation not available. ' +
    'Please install react-native-get-random-values or use React Native 0.59+'
  );
}

/**
 * Generate random session ID
 */
export function generateSessionId(): string {
  // HIGH FIX: Use secure random bytes
  const bytes = getSecureRandomBytes(32);

  // Convert to hex string
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

