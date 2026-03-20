/**
 * TON Connect v2 Protocol Implementation
 * Builds correct universal links and parses bridge responses
 */

import type {
  SendTransactionRequest,
  WalletInfo,
  ConnectEvent,
  ConnectErrorEvent,
  RpcResponse,
  RpcErrorResponse,
} from '../types';

/**
 * Protocol version
 */
const PROTOCOL_VERSION = '2';

/**
 * Build a TON Connect v2 universal link for wallet connection
 * Format: {universalLink}?v=2&id={sessionId}&r={connectRequest}&ret={returnStrategy}
 */
export function buildConnectUniversalLink(
  universalLink: string,
  sessionId: string,
  manifestUrl: string,
  returnStrategy: string = 'back'
): string {
  // Build connect request (TON Connect v2 format)
  const connectRequest = {
    manifestUrl,
    items: [{ name: 'ton_addr' }],
  };

  // Build URL with proper query parameters
  const r = JSON.stringify(connectRequest);
  const params = [
    `v=${PROTOCOL_VERSION}`,
    `id=${sessionId}`,
    `r=${encodeURIComponent(r)}`,
    `ret=${encodeURIComponent(returnStrategy)}`,
  ];

  // Handle wallet universal links that may already have query params
  const separator = universalLink.includes('?') ? '&' : '?';
  return `${universalLink}${separator}${params.join('&')}`;
}

/**
 * Build a universal link to bring wallet to foreground (for pending transactions)
 * Format: {universalLink}?ret={returnStrategy}
 */
export function buildReturnUniversalLink(
  universalLink: string,
  returnStrategy: string = 'back'
): string {
  const separator = universalLink.includes('?') ? '&' : '?';
  return `${universalLink}${separator}ret=${encodeURIComponent(returnStrategy)}`;
}

/**
 * Build a JSON-RPC request for sendTransaction
 */
export function buildSendTransactionRpcRequest(
  request: SendTransactionRequest,
  id: number
): string {
  // TON Connect v2 sendTransaction format
  const params = JSON.stringify({
    valid_until: Math.floor(request.validUntil / 1000), // Convert ms to seconds
    network: request.network === 'testnet' ? '-3' : '-239',
    from: request.from,
    messages: request.messages.map((msg) => ({
      address: msg.address,
      amount: msg.amount,
      payload: msg.payload,
      stateInit: msg.stateInit,
    })),
  });

  return JSON.stringify({
    method: 'sendTransaction',
    params: [params],
    id,
  });
}

/**
 * Build a JSON-RPC request for disconnect
 */
export function buildDisconnectRpcRequest(id: number): string {
  return JSON.stringify({
    method: 'disconnect',
    params: [],
    id,
  });
}

/**
 * Parse a connect response from the wallet (received via bridge, after decryption)
 */
export function parseConnectResponse(
  decrypted: string
): { type: 'connect'; data: ConnectEvent } | { type: 'error'; data: ConnectErrorEvent } | null {
  try {
    const parsed = JSON.parse(decrypted);

    if (parsed.event === 'connect' && parsed.payload) {
      return { type: 'connect', data: parsed as ConnectEvent };
    }

    if (parsed.event === 'connect_error' && parsed.payload) {
      return { type: 'error', data: parsed as ConnectErrorEvent };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse an RPC response from the wallet (for sendTransaction, disconnect, etc.)
 */
export function parseRpcResponse(
  decrypted: string
): { type: 'result'; data: RpcResponse } | { type: 'error'; data: RpcErrorResponse } | { type: 'event'; event: string; data: any } | null {
  try {
    const parsed = JSON.parse(decrypted);

    // Check for events (disconnect, etc.)
    if (parsed.event) {
      return { type: 'event', event: parsed.event, data: parsed.payload || null };
    }

    // Check for RPC result
    if ('result' in parsed && parsed.id !== undefined) {
      return { type: 'result', data: parsed as RpcResponse };
    }

    // Check for RPC error
    if ('error' in parsed && parsed.id !== undefined) {
      return { type: 'error', data: parsed as RpcErrorResponse };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract wallet info from a connect event
 */
export function extractWalletInfoFromEvent(event: ConnectEvent): WalletInfo {
  const tonAddr = event.payload.items.find((item: any) => item.name === 'ton_addr');
  if (!tonAddr) {
    throw new Error('Connect response missing ton_addr item');
  }

  const device = event.payload.device || {};

  return {
    name: device.appName || 'Unknown Wallet',
    appName: device.appName || 'unknown',
    version: device.appVersion || 'unknown',
    platform: (device.platform as 'ios' | 'android' | 'unknown') || 'unknown',
    address: tonAddr.address,
    publicKey: tonAddr.publicKey,
    network: tonAddr.network,
    walletStateInit: tonAddr.walletStateInit,
    icon: undefined,
  };
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

  for (let i = 0; i < request.messages.length; i++) {
    const msg = request.messages[i];

    if (!msg.address || typeof msg.address !== 'string') {
      return { valid: false, error: `Message ${i + 1}: Address is required` };
    }

    if (!msg.amount || typeof msg.amount !== 'string') {
      return { valid: false, error: `Message ${i + 1}: Amount is required (nanotons string)` };
    }

    try {
      const amount = BigInt(msg.amount);
      if (amount <= 0n) {
        return { valid: false, error: `Message ${i + 1}: Amount must be > 0` };
      }
    } catch {
      return { valid: false, error: `Message ${i + 1}: Amount must be a valid number string` };
    }
  }

  if (request.messages.length > 255) {
    return { valid: false, error: 'Maximum 255 messages per transaction' };
  }

  return { valid: true };
}
