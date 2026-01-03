/**
 * Core TonConnect protocol implementation
 * Pure TypeScript, no platform dependencies
 */

// Type declarations for runtime globals
declare const TextEncoder: {
  new (): {
    encode(input: string): Uint8Array;
  };
} | undefined;

import {
  ConnectionRequestPayload,
  ConnectionResponsePayload,
  TransactionRequestPayload,
  TransactionResponsePayload,
  ErrorResponse,
  WalletInfo,
  TransactionMessage,
  SendTransactionRequest,
} from '../types';

/**
 * TonConnect protocol constants
 */
const PROTOCOL_VERSION = '2';
const CONNECT_PREFIX = 'tonconnect://connect';
const SEND_TRANSACTION_PREFIX = 'tonconnect://send-transaction';
const CALLBACK_PREFIX = 'tonconnect';

/**
 * Get TextEncoder with availability check
 */
function getTextEncoder(): { encode(input: string): Uint8Array } {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder();
  }
  throw new Error('TextEncoder is not available. Please use React Native 0.59+ or add a polyfill.');
}

/**
 * Encode string to base64
 */
function base64Encode(str: string): string {
  // Use TextEncoder to convert string to bytes
  const encoder = getTextEncoder();
  const bytes = encoder.encode(str);
  
  // Convert bytes to base64
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;
  
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    
    const bitmap = (a << 16) | (b << 8) | c;
    
    result += chars.charAt((bitmap >> 18) & 63);
    result += chars.charAt((bitmap >> 12) & 63);
    result += i - 2 < bytes.length ? chars.charAt((bitmap >> 6) & 63) : '=';
    result += i - 1 < bytes.length ? chars.charAt(bitmap & 63) : '=';
  }
  
  return result;
}

/**
 * Decode base64 to string
 */
function base64Decode(base64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let buffer = 0;
  let bitsCollected = 0;
  let result = '';
  
  for (let i = 0; i < base64.length; i++) {
    const ch = base64[i];
    if (ch === '=') break;
    
    const index = chars.indexOf(ch);
    if (index === -1) continue;
    
    buffer = (buffer << 6) | index;
    bitsCollected += 6;
    
    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      result += String.fromCharCode((buffer >> bitsCollected) & 0xff);
      buffer &= (1 << bitsCollected) - 1;
    }
  }
  
  return result;
}

/**
 * Encode JSON to base64 URL-safe string
 */
export function encodeBase64URL(data: unknown): string {
  const json = JSON.stringify(data);
  const base64 = base64Encode(json);
  // Convert to URL-safe base64
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode base64 URL-safe string to JSON
 */
export function decodeBase64URL<T>(encoded: string): T {
  // Convert from URL-safe base64
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding if needed
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const json = base64Decode(padded);
  return JSON.parse(json) as T;
}

/**
 * Build connection request URL
 * Format: tonconnect://connect?<base64_encoded_payload>
 */
export function buildConnectionRequest(
  manifestUrl: string,
  returnScheme: string
): string {
  const payload: ConnectionRequestPayload = {
    manifestUrl,
    items: [{ name: 'ton_addr' }],
    returnStrategy: 'back',
  };

  const encoded = encodeBase64URL(payload);
  return `${CONNECT_PREFIX}?${encoded}`;
}

/**
 * Build transaction request URL
 * Format: tonconnect://send-transaction?<base64_encoded_payload>
 */
export function buildTransactionRequest(
  manifestUrl: string,
  request: SendTransactionRequest,
  returnScheme: string
): string {
  const payload: TransactionRequestPayload = {
    manifestUrl,
    request: {
      validUntil: request.validUntil,
      messages: request.messages.map((msg) => ({
        address: msg.address,
        amount: msg.amount,
        payload: msg.payload,
        stateInit: msg.stateInit,
      })),
      network: request.network,
      from: request.from,
    },
    returnStrategy: 'back',
  };

  const encoded = encodeBase64URL(payload);
  return `${SEND_TRANSACTION_PREFIX}?${encoded}`;
}

/**
 * Parse callback URL
 * Format: <scheme>://tonconnect?<base64_encoded_response>
 */
export function parseCallbackURL(url: string, scheme: string): {
  type: 'connect' | 'transaction' | 'error' | 'unknown';
  data: ConnectionResponsePayload | TransactionResponsePayload | ErrorResponse | null;
} {
  try {
    // CRITICAL FIX: Validate URL input
    if (!url || typeof url !== 'string') {
      return { type: 'unknown', data: null };
    }

    // CRITICAL FIX: Validate URL length (prevent DoS)
    if (url.length > 10000) {
      return { type: 'unknown', data: null };
    }

    // CRITICAL FIX: Validate scheme format
    if (!scheme || typeof scheme !== 'string' || scheme.length === 0 || scheme.length > 50) {
      return { type: 'unknown', data: null };
    }

    // CRITICAL FIX: Exact scheme matching (case-sensitive)
    const expectedPrefix = `${scheme}://${CALLBACK_PREFIX}?`;
    if (!url.startsWith(expectedPrefix)) {
      return { type: 'unknown', data: null };
    }

    // CRITICAL FIX: Validate URL structure - should be exactly scheme://tonconnect?<payload>
    // Check that there's no additional path or query params
    const urlAfterScheme = url.substring(scheme.length + 3); // After "scheme://"
    if (!urlAfterScheme.startsWith(`${CALLBACK_PREFIX}?`)) {
      return { type: 'unknown', data: null };
    }

    // Extract encoded payload
    const encoded = url.substring(expectedPrefix.length);

    // CRITICAL FIX: Validate base64 payload size (prevent DoS)
    if (encoded.length === 0 || encoded.length > 5000) {
      return { type: 'unknown', data: null };
    }

    // CRITICAL FIX: Validate base64 characters only
    if (!/^[A-Za-z0-9_-]+$/.test(encoded)) {
      return { type: 'unknown', data: null };
    }

    const decoded = decodeBase64URL(encoded);

    // Validate decoded data is an object
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      return { type: 'unknown', data: null };
    }

    // Check if it's an error response
    if ('error' in decoded && typeof decoded.error === 'object') {
      const errorData = decoded as ErrorResponse;
      if (errorData.error && typeof errorData.error.code === 'number' && typeof errorData.error.message === 'string') {
        return { type: 'error', data: errorData };
      }
    }

    // Check if it's a connection response (has session, address, publicKey)
    if (
      'session' in decoded &&
      'address' in decoded &&
      'publicKey' in decoded &&
      typeof decoded.session === 'string' &&
      typeof decoded.address === 'string' &&
      typeof decoded.publicKey === 'string'
    ) {
      return { type: 'connect', data: decoded as ConnectionResponsePayload };
    }

    // Check if it's a transaction response (has boc, signature)
    if (
      'boc' in decoded &&
      'signature' in decoded &&
      typeof decoded.boc === 'string' &&
      typeof decoded.signature === 'string'
    ) {
      return { type: 'transaction', data: decoded as TransactionResponsePayload };
    }

    return { type: 'unknown', data: null };
  } catch (error) {
    // Log error for debugging but don't expose details
    return { type: 'unknown', data: null };
  }
}

/**
 * Extract wallet info from connection response
 */
export function extractWalletInfo(
  response: ConnectionResponsePayload
): WalletInfo {
  return {
    name: response.name,
    appName: response.appName,
    version: response.version,
    platform: response.platform || 'unknown',
    address: response.address,
    publicKey: response.publicKey,
    icon: response.icon,
  };
}

/**
 * Validate connection response
 */
export function validateConnectionResponse(
  response: ConnectionResponsePayload
): boolean {
  return !!(
    response.session &&
    response.address &&
    response.publicKey &&
    response.name &&
    response.appName &&
    response.version
  );
}

/**
 * Validate transaction response
 */
export function validateTransactionResponse(
  response: TransactionResponsePayload
): boolean {
  return !!(response.boc && response.signature);
}

/**
 * Validate transaction request
 */
export function validateTransactionRequest(
  request: SendTransactionRequest
): { valid: boolean; error?: string } {
  if (!request.validUntil || request.validUntil <= Date.now()) {
    return { valid: false, error: 'Transaction request has expired' };
  }

  if (!request.messages || request.messages.length === 0) {
    return { valid: false, error: 'Transaction must have at least one message' };
  }

  for (const msg of request.messages) {
    if (!msg.address) {
      return { valid: false, error: 'Message address is required' };
    }
    if (!msg.amount || isNaN(Number(msg.amount))) {
      return { valid: false, error: 'Message amount must be a valid number' };
    }
  }

  return { valid: true };
}

