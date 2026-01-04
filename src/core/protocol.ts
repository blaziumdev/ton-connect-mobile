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
const CONNECT_UNIVERSAL_PREFIX = 'https://app.tonkeeper.com/ton-connect';
const SEND_TRANSACTION_PREFIX = 'tonconnect://send-transaction';
const SEND_TRANSACTION_UNIVERSAL_PREFIX = 'https://app.tonkeeper.com/ton-connect/send-transaction';
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
 * Or universal link: https://app.tonkeeper.com/ton-connect?<base64_encoded_payload>
 * Or custom wallet universal link
 */
export function buildConnectionRequest(
  manifestUrl: string,
  returnScheme: string,
  walletUniversalLink?: string,
  returnStrategy?: 'back' | 'post_redirect' | 'none',
  requiresReturnScheme?: boolean
): string {
  // Build payload with required fields
  const payload: ConnectionRequestPayload = {
    manifestUrl,
    items: [{ name: 'ton_addr' }],
    returnStrategy: returnStrategy || 'back',
  };

  // CRITICAL FIX: Many wallets (Tonhub, MyTonWallet, Telegram Wallet) require returnScheme
  // in the payload to properly handle mobile app callbacks. While not in the official
  // protocol spec, it's a de-facto requirement for mobile apps.
  if (requiresReturnScheme !== false) {
    // Default to true if not specified - safer to include it
    payload.returnScheme = returnScheme;
  }

  const encoded = encodeBase64URL(payload);
  
  // Use custom wallet universal link if provided
  if (walletUniversalLink) {
    return `${walletUniversalLink}?${encoded}`;
  }
  
  // Default to Tonkeeper universal link for Android compatibility
  return `${CONNECT_UNIVERSAL_PREFIX}?${encoded}`;
}

/**
 * Build transaction request URL
 * Format: tonconnect://send-transaction?<base64_encoded_payload>
 * Or universal link: https://app.tonkeeper.com/ton-connect/send-transaction?<base64_encoded_payload>
 * Or custom wallet universal link
 */
export function buildTransactionRequest(
  manifestUrl: string,
  request: SendTransactionRequest,
  returnScheme: string,
  walletUniversalLink?: string,
  returnStrategy?: 'back' | 'post_redirect' | 'none',
  requiresReturnScheme?: boolean
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
    returnStrategy: returnStrategy || 'back',
  };

  // CRITICAL FIX: Include returnScheme for mobile wallets that require it
  if (requiresReturnScheme !== false) {
    payload.returnScheme = returnScheme;
  }

  const encoded = encodeBase64URL(payload);
  
  // Use custom wallet universal link if provided
  if (walletUniversalLink) {
    // For transaction, append /send-transaction to the base universal link
    const baseUrl = walletUniversalLink.endsWith('/ton-connect') 
      ? walletUniversalLink 
      : `${walletUniversalLink}/ton-connect`;
    return `${baseUrl}/send-transaction?${encoded}`;
  }
  
  // Default to Tonkeeper universal link for Android compatibility
  return `${SEND_TRANSACTION_UNIVERSAL_PREFIX}?${encoded}`;
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
    let encoded = url.substring(expectedPrefix.length);

    // CRITICAL FIX: Decode URL encoding first (wallet may URL-encode the payload)
    try {
      encoded = decodeURIComponent(encoded);
    } catch (error) {
      // If decodeURIComponent fails, try using the original encoded string
      // Some wallets may not URL-encode the payload
      console.log('[TON Connect] Payload not URL-encoded, using as-is');
    }

    // CRITICAL FIX: Validate base64 payload size (prevent DoS)
    if (encoded.length === 0 || encoded.length > 5000) {
      return { type: 'unknown', data: null };
    }

    // CRITICAL FIX: Validate base64 characters only (after URL decoding)
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
 * CRITICAL: This function assumes response has been validated by validateConnectionResponse
 */
export function extractWalletInfo(
  response: ConnectionResponsePayload
): WalletInfo {
  // CRITICAL FIX: Add null checks to prevent runtime errors
  if (!response || !response.name || !response.address || !response.publicKey) {
    throw new Error('Invalid connection response: missing required fields');
  }
  
  return {
    name: response.name,
    appName: response.appName || response.name,
    version: response.version || 'unknown',
    platform: response.platform || 'unknown',
    address: response.address,
    publicKey: response.publicKey,
    icon: response.icon,
  };
}

/**
 * Validate connection response
 * CRITICAL FIX: Only validate truly required fields (session, address, publicKey, name)
 * appName and version are optional - extractWalletInfo has fallbacks for them
 */
export function validateConnectionResponse(
  response: ConnectionResponsePayload
): boolean {
  return !!(
    response.session &&
    response.address &&
    response.publicKey &&
    response.name
    // Note: appName and version are optional - extractWalletInfo handles fallbacks
    // Some wallets may not send these fields, and that's OK
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

  // CRITICAL: Validate each message
  for (let i = 0; i < request.messages.length; i++) {
    const msg = request.messages[i];
    
    // Validate address
    if (!msg.address || typeof msg.address !== 'string') {
      return { valid: false, error: `Message ${i + 1}: Address is required and must be a string` };
    }
    
    // CRITICAL: Validate TON address format (EQ... or 0Q...)
    if (!/^(EQ|0Q)[A-Za-z0-9_-]{46}$/.test(msg.address)) {
      return { valid: false, error: `Message ${i + 1}: Invalid TON address format. Address must start with EQ or 0Q and be 48 characters long.` };
    }
    
    // Validate amount
    if (!msg.amount || typeof msg.amount !== 'string') {
      return { valid: false, error: `Message ${i + 1}: Amount is required and must be a string (nanotons)` };
    }
    
    // CRITICAL: Validate amount is a valid positive number (nanotons)
    try {
      const amount = BigInt(msg.amount);
      if (amount <= 0n) {
        return { valid: false, error: `Message ${i + 1}: Amount must be greater than 0` };
      }
      // Check for reasonable maximum (prevent overflow)
      if (amount > BigInt('1000000000000000000')) { // 1 billion TON
        return { valid: false, error: `Message ${i + 1}: Amount exceeds maximum allowed (1 billion TON)` };
      }
    } catch (error) {
      return { valid: false, error: `Message ${i + 1}: Amount must be a valid number string (nanotons)` };
    }
    
    // Validate payload if provided (must be base64)
    if (msg.payload !== undefined && msg.payload !== null) {
      if (typeof msg.payload !== 'string') {
        return { valid: false, error: `Message ${i + 1}: Payload must be a base64 string` };
      }
      // Basic base64 validation
      if (msg.payload.length > 0 && !/^[A-Za-z0-9+/=]+$/.test(msg.payload)) {
        return { valid: false, error: `Message ${i + 1}: Payload must be valid base64 encoded` };
      }
    }
    
    // Validate stateInit if provided (must be base64)
    if (msg.stateInit !== undefined && msg.stateInit !== null) {
      if (typeof msg.stateInit !== 'string') {
        return { valid: false, error: `Message ${i + 1}: StateInit must be a base64 string` };
      }
      // Basic base64 validation
      if (msg.stateInit.length > 0 && !/^[A-Za-z0-9+/=]+$/.test(msg.stateInit)) {
        return { valid: false, error: `Message ${i + 1}: StateInit must be valid base64 encoded` };
      }
    }
  }

  // CRITICAL: Limit maximum number of messages (prevent DoS)
  if (request.messages.length > 255) {
    return { valid: false, error: 'Transaction cannot have more than 255 messages' };
  }

  return { valid: true };
}

