/**
 * Cryptographic utilities for TonConnect
 * Legacy module — primary crypto is now in session.ts
 * This module provides helper functions that may be used externally
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nacl = require('tweetnacl');

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
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
  // eslint-disable-next-line no-undef
  if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && (globalThis as any).crypto.getRandomValues) {
    (globalThis as any).crypto.getRandomValues(bytes);
    return bytes;
  }
  throw new Error(
    'Cryptographically secure random number generation not available. ' +
    'Please install react-native-get-random-values or use React Native 0.59+'
  );
}

/**
 * Generate random session ID
 */
export function generateSessionId(): string {
  const bytes = getSecureRandomBytes(32);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify Ed25519 signature
 */
export function verifySignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  try {
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}
