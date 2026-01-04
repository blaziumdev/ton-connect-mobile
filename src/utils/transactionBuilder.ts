/**
 * Transaction Builder Utilities
 * Helper functions for building TON Connect transaction requests
 */

import type { SendTransactionRequest, TransactionMessage } from '../types';

/**
 * Convert TON amount to nanotons
 * @param tonAmount - Amount in TON (e.g., 1.5 for 1.5 TON)
 * @returns Amount in nanotons as string
 */
export function tonToNano(tonAmount: number | string): string {
  const amount = typeof tonAmount === 'string' ? parseFloat(tonAmount) : tonAmount;
  if (isNaN(amount) || amount < 0) {
    throw new Error('Invalid TON amount');
  }
  const nanotons = Math.floor(amount * 1_000_000_000);
  return nanotons.toString();
}

/**
 * Convert nanotons to TON
 * @param nanotons - Amount in nanotons as string
 * @returns Amount in TON as number
 */
export function nanoToTon(nanotons: string): number {
  const nano = BigInt(nanotons);
  return Number(nano) / 1_000_000_000;
}

/**
 * Build a simple TON transfer transaction
 * @param to - Recipient address (EQ... format)
 * @param amount - Amount in TON (will be converted to nanotons)
 * @param validUntil - Optional expiration timestamp (default: 5 minutes from now)
 * @returns Transaction request
 */
export function buildTransferTransaction(
  to: string,
  amount: number | string,
  validUntil?: number
): SendTransactionRequest {
  // Validate address
  if (!to || typeof to !== 'string') {
    throw new Error('Recipient address is required');
  }
  if (!isValidTonAddress(to)) {
    throw new Error(`Invalid TON address format: ${to}`);
  }

  // Validate amount
  const nanoAmount = tonToNano(amount);
  if (BigInt(nanoAmount) <= 0n) {
    throw new Error('Transaction amount must be greater than 0');
  }

  // Validate validUntil
  const expiration = validUntil || Date.now() + 5 * 60 * 1000; // 5 minutes default
  if (expiration <= Date.now()) {
    throw new Error('Transaction expiration must be in the future');
  }

  return {
    validUntil: expiration,
    messages: [
      {
        address: to,
        amount: nanoAmount,
      },
    ],
  };
}

/**
 * Build a transaction with multiple recipients
 * @param transfers - Array of {to, amount} transfers
 * @param validUntil - Optional expiration timestamp (default: 5 minutes from now)
 * @returns Transaction request
 */
export function buildMultiTransferTransaction(
  transfers: Array<{ to: string; amount: number | string }>,
  validUntil?: number
): SendTransactionRequest {
  // Validate transfers array
  if (!transfers || !Array.isArray(transfers) || transfers.length === 0) {
    throw new Error('Transfers array is required and cannot be empty');
  }
  if (transfers.length > 255) {
    throw new Error('Maximum 255 transfers allowed per transaction');
  }

  // Validate each transfer
  const messages = transfers.map((transfer, index) => {
    if (!transfer.to || typeof transfer.to !== 'string') {
      throw new Error(`Transfer ${index + 1}: Recipient address is required`);
    }
    if (!isValidTonAddress(transfer.to)) {
      throw new Error(`Transfer ${index + 1}: Invalid TON address format: ${transfer.to}`);
    }
    const nanoAmount = tonToNano(transfer.amount);
    if (BigInt(nanoAmount) <= 0n) {
      throw new Error(`Transfer ${index + 1}: Amount must be greater than 0`);
    }
    return {
      address: transfer.to,
      amount: nanoAmount,
    };
  });

  // Validate validUntil
  const expiration = validUntil || Date.now() + 5 * 60 * 1000;
  if (expiration <= Date.now()) {
    throw new Error('Transaction expiration must be in the future');
  }

  return {
    validUntil: expiration,
    messages,
  };
}

/**
 * Build a transaction with custom payload
 * @param to - Recipient address
 * @param amount - Amount in TON
 * @param payload - Base64 encoded payload
 * @param validUntil - Optional expiration timestamp
 * @returns Transaction request
 */
export function buildTransactionWithPayload(
  to: string,
  amount: number | string,
  payload: string,
  validUntil?: number
): SendTransactionRequest {
  return {
    validUntil: validUntil || Date.now() + 5 * 60 * 1000,
    messages: [
      {
        address: to,
        amount: tonToNano(amount),
        payload,
      },
    ],
  };
}

/**
 * Build a transaction with state init (for contract deployment)
 * @param to - Recipient address
 * @param amount - Amount in TON
 * @param stateInit - Base64 encoded state init
 * @param validUntil - Optional expiration timestamp
 * @returns Transaction request
 */
export function buildTransactionWithStateInit(
  to: string,
  amount: number | string,
  stateInit: string,
  validUntil?: number
): SendTransactionRequest {
  return {
    validUntil: validUntil || Date.now() + 5 * 60 * 1000,
    messages: [
      {
        address: to,
        amount: tonToNano(amount),
        stateInit,
      },
    ],
  };
}

/**
 * Validate TON address format
 * @param address - Address to validate
 * @returns true if address is valid
 */
export function isValidTonAddress(address: string): boolean {
  // TON addresses start with EQ or 0Q and are 48 characters long (base64)
  return /^(EQ|0Q)[A-Za-z0-9_-]{46}$/.test(address);
}

/**
 * Format TON address for display (with ellipsis)
 * @param address - Full address
 * @param startLength - Characters to show at start (default: 6)
 * @param endLength - Characters to show at end (default: 4)
 * @returns Formatted address
 */
export function formatTonAddress(
  address: string,
  startLength: number = 6,
  endLength: number = 4
): string {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.substring(0, startLength)}...${address.substring(address.length - endLength)}`;
}

