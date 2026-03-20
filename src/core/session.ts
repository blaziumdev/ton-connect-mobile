/**
 * Session crypto for TON Connect v2 protocol
 * Uses X25519 (NaCl box) for key exchange and message encryption
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const nacl = require('tweetnacl');

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const padded = clean.length % 2 === 0 ? clean : '0' + clean;
  const bytes = new Uint8Array(padded.length / 2);
  for (let i = 0; i < padded.length; i += 2) {
    bytes[i / 2] = parseInt(padded.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to base64
 */
export function bytesToBase64(bytes: Uint8Array): string {
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
 * Convert base64 to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;
  for (let i = 0; i < base64.length; i++) {
    const ch = base64[i];
    if (ch === '=') break;
    // Also handle URL-safe base64
    let index: number;
    if (ch === '-') {
      index = 62;
    } else if (ch === '_') {
      index = 63;
    } else {
      index = chars.indexOf(ch);
    }
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
 * Serialized session state for persistence
 */
export interface SessionState {
  secretKey: string; // hex-encoded
  walletPublicKey?: string; // hex-encoded, set after connection
}

/**
 * Session crypto for TON Connect v2
 * Handles X25519 key exchange and NaCl box encryption/decryption
 */
export class SessionCrypto {
  private keypair: { publicKey: Uint8Array; secretKey: Uint8Array };

  constructor(existingSecretKey?: Uint8Array) {
    if (existingSecretKey) {
      this.keypair = nacl.box.keyPair.fromSecretKey(existingSecretKey);
    } else {
      this.keypair = nacl.box.keyPair();
    }
  }

  /**
   * Session ID = hex-encoded public key (used as client_id in bridge)
   */
  get sessionId(): string {
    return bytesToHex(this.keypair.publicKey);
  }

  /**
   * Public key bytes
   */
  get publicKey(): Uint8Array {
    return this.keypair.publicKey;
  }

  /**
   * Secret key bytes (for persistence)
   */
  get secretKey(): Uint8Array {
    return this.keypair.secretKey;
  }

  /**
   * Encrypt a message for a recipient
   * Format: nonce (24 bytes) + ciphertext
   */
  encrypt(message: string, receiverPublicKey: Uint8Array): Uint8Array {
    const msgBytes = encodeUTF8(message);
    const nonce = nacl.randomBytes(nacl.box.nonceLength); // 24 bytes
    const encrypted = nacl.box(msgBytes, nonce, receiverPublicKey, this.keypair.secretKey);
    if (!encrypted) {
      throw new Error('Encryption failed');
    }
    // Prepend nonce to ciphertext
    const result = new Uint8Array(nonce.length + encrypted.length);
    result.set(nonce);
    result.set(encrypted, nonce.length);
    return result;
  }

  /**
   * Decrypt a message from a sender
   * Input format: nonce (24 bytes) + ciphertext
   */
  decrypt(encryptedMessage: Uint8Array, senderPublicKey: Uint8Array): string {
    if (encryptedMessage.length < nacl.box.nonceLength) {
      throw new Error('Encrypted message too short');
    }
    const nonce = encryptedMessage.slice(0, nacl.box.nonceLength);
    const ciphertext = encryptedMessage.slice(nacl.box.nonceLength);
    const decrypted = nacl.box.open(ciphertext, nonce, senderPublicKey, this.keypair.secretKey);
    if (!decrypted) {
      throw new Error('Decryption failed — invalid key or corrupted message');
    }
    return decodeUTF8(decrypted);
  }

  /**
   * Serialize session for persistence
   */
  serialize(): SessionState {
    return {
      secretKey: bytesToHex(this.keypair.secretKey),
    };
  }

  /**
   * Restore session from persisted state
   */
  static fromState(state: SessionState): SessionCrypto {
    return new SessionCrypto(hexToBytes(state.secretKey));
  }
}

/**
 * Encode string to UTF-8 Uint8Array
 */
function encodeUTF8(str: string): Uint8Array {
  // eslint-disable-next-line no-undef
  if (typeof globalThis !== 'undefined' && (globalThis as any).TextEncoder) {
    // eslint-disable-next-line no-undef
    return new (globalThis as any).TextEncoder().encode(str);
  }
  // Fallback for older environments
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let charCode = str.charCodeAt(i);
    if (charCode < 0x80) {
      bytes.push(charCode);
    } else if (charCode < 0x800) {
      bytes.push(0xc0 | (charCode >> 6), 0x80 | (charCode & 0x3f));
    } else if (charCode >= 0xd800 && charCode < 0xdc00) {
      // Surrogate pair
      i++;
      const low = str.charCodeAt(i);
      charCode = ((charCode - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
      bytes.push(
        0xf0 | (charCode >> 18),
        0x80 | ((charCode >> 12) & 0x3f),
        0x80 | ((charCode >> 6) & 0x3f),
        0x80 | (charCode & 0x3f)
      );
    } else {
      bytes.push(0xe0 | (charCode >> 12), 0x80 | ((charCode >> 6) & 0x3f), 0x80 | (charCode & 0x3f));
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Decode UTF-8 Uint8Array to string
 */
function decodeUTF8(bytes: Uint8Array): string {
  // eslint-disable-next-line no-undef
  if (typeof globalThis !== 'undefined' && (globalThis as any).TextDecoder) {
    // eslint-disable-next-line no-undef
    return new (globalThis as any).TextDecoder().decode(bytes);
  }
  // Fallback
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const byte = bytes[i];
    if (byte < 0x80) {
      result += String.fromCharCode(byte);
      i++;
    } else if ((byte & 0xe0) === 0xc0) {
      result += String.fromCharCode(((byte & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      result += String.fromCharCode(((byte & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else {
      const codePoint =
        ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      // Convert to surrogate pair
      const offset = codePoint - 0x10000;
      result += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff));
      i += 4;
    }
  }
  return result;
}
