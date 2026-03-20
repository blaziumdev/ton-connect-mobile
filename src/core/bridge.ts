/**
 * TON Connect v2 Bridge Gateway
 * Handles SSE connection for receiving wallet responses and POST for sending messages
 */

import { bytesToBase64, base64ToBytes } from './session';

// Type declarations
declare const XMLHttpRequest: {
  new (): XMLHttpRequestInstance;
} | undefined;

interface XMLHttpRequestInstance {
  readyState: number;
  responseText: string;
  status: number;
  open(method: string, url: string, async?: boolean): void;
  setRequestHeader(name: string, value: string): void;
  send(data?: string | null): void;
  abort(): void;
  onreadystatechange: (() => void) | null;
  onerror: (() => void) | null;
}

/**
 * Parsed SSE event
 */
interface SSEEvent {
  id?: string;
  data?: string;
}

/**
 * Bridge message received from wallet
 */
export interface BridgeIncomingMessage {
  from: string; // hex-encoded sender public key
  message: string; // base64-encoded encrypted message
}

/**
 * Bridge Gateway for TON Connect v2 HTTP Bridge
 */
export class BridgeGateway {
  private xhr: XMLHttpRequestInstance | null = null;
  private lastEventId: string = '';
  private active: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private bridgeUrl: string = '';
  private clientId: string = '';
  private onMessageCallback: ((msg: BridgeIncomingMessage) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  /**
   * Connect to the bridge SSE endpoint
   * Listens for incoming messages from the wallet
   */
  connect(
    bridgeUrl: string,
    clientId: string,
    onMessage: (msg: BridgeIncomingMessage) => void,
    onError?: (error: Error) => void
  ): void {
    this.bridgeUrl = bridgeUrl;
    this.clientId = clientId;
    this.onMessageCallback = onMessage;
    this.onErrorCallback = onError || null;
    this.active = true;
    this.openSSE();
  }

  /**
   * Open SSE connection using XMLHttpRequest (works in React Native)
   */
  private openSSE(): void {
    if (!this.active) return;

    // Build URL
    let url = `${this.bridgeUrl}/events?client_id=${this.clientId}`;
    if (this.lastEventId) {
      url += `&last_event_id=${this.lastEventId}`;
    }

    console.log('[Bridge] Opening SSE connection:', url);

    // Use XMLHttpRequest for SSE (available in React Native)
    if (typeof XMLHttpRequest === 'undefined') {
      // Fallback: use fetch-based polling
      this.pollWithFetch(url);
      return;
    }

    const xhr = new XMLHttpRequest();
    this.xhr = xhr;

    let processedLength = 0;
    let buffer = '';

    xhr.onreadystatechange = () => {
      // LOADING (3) or DONE (4) — process incoming data
      if (xhr.readyState >= 3) {
        try {
          const newData = xhr.responseText.substring(processedLength);
          processedLength = xhr.responseText.length;

          if (newData) {
            buffer += newData;
            const parsed = this.parseSSE(buffer);
            buffer = parsed.remaining;

            for (const event of parsed.events) {
              if (event.id) {
                this.lastEventId = event.id;
              }
              if (event.data) {
                this.handleEventData(event.data);
              }
            }
          }
        } catch (e) {
          // Ignore parse errors, continue listening
          console.warn('[Bridge] SSE parse error:', e);
        }
      }

      // Connection closed (readyState 4) — reconnect if still active
      if (xhr.readyState === 4 && this.active) {
        console.log('[Bridge] SSE connection closed, reconnecting...');
        this.scheduleReconnect();
      }
    };

    xhr.onerror = () => {
      console.error('[Bridge] SSE connection error');
      if (this.active) {
        this.scheduleReconnect();
      }
    };

    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.send();
  }

  /**
   * Fallback: poll bridge with fetch (for environments without XMLHttpRequest streaming)
   */
  private async pollWithFetch(url: string): Promise<void> {
    while (this.active) {
      try {
        let pollUrl = `${this.bridgeUrl}/events?client_id=${this.clientId}`;
        if (this.lastEventId) {
          pollUrl += `&last_event_id=${this.lastEventId}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const response = await fetch(pollUrl, {
          headers: { 'Accept': 'text/event-stream' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const text = await response.text();
        const parsed = this.parseSSE(text);

        for (const event of parsed.events) {
          if (event.id) {
            this.lastEventId = event.id;
          }
          if (event.data) {
            this.handleEventData(event.data);
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          // Timeout — reconnect
          continue;
        }
        console.error('[Bridge] Fetch poll error:', error);
        // Wait before retrying
        await new Promise<void>((resolve) => setTimeout(() => resolve(), 2000));
      }
    }
  }

  /**
   * Handle a single SSE event data
   */
  private handleEventData(data: string): void {
    try {
      const parsed = JSON.parse(data) as BridgeIncomingMessage;
      if (parsed.from && parsed.message) {
        console.log('[Bridge] Received message from:', parsed.from.substring(0, 16) + '...');
        if (this.onMessageCallback) {
          this.onMessageCallback(parsed);
        }
      }
    } catch (e) {
      // Might be a heartbeat or other non-JSON data — ignore
      console.log('[Bridge] Non-message event:', data.substring(0, 50));
    }
  }

  /**
   * Schedule reconnection after a delay
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(() => {
      if (this.active) {
        this.openSSE();
      }
    }, 1500);
  }

  /**
   * Send an encrypted message via the bridge
   */
  async send(
    bridgeUrl: string,
    fromClientId: string,
    toClientId: string,
    encryptedMessage: Uint8Array,
    ttl: number = 300
  ): Promise<void> {
    const base64Message = bytesToBase64(encryptedMessage);
    const url = `${bridgeUrl}/message?client_id=${fromClientId}&to=${toClientId}&ttl=${ttl}`;

    console.log('[Bridge] Sending message to:', toClientId.substring(0, 16) + '...');

    const response = await fetch(url, {
      method: 'POST',
      body: base64Message,
      headers: {
        'Content-Type': 'text/plain',
      },
    });

    if (!response.ok) {
      throw new Error(`Bridge send failed: ${response.status} ${response.statusText}`);
    }

    console.log('[Bridge] Message sent successfully');
  }

  /**
   * Close the bridge connection
   */
  close(): void {
    console.log('[Bridge] Closing connection');
    this.active = false;

    if (this.xhr) {
      this.xhr.abort();
      this.xhr = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.onMessageCallback = null;
    this.onErrorCallback = null;
  }

  /**
   * Check if bridge is currently connected/active
   */
  get isConnected(): boolean {
    return this.active;
  }

  /**
   * Parse SSE text into events
   */
  private parseSSE(text: string): { events: SSEEvent[]; remaining: string } {
    const events: SSEEvent[] = [];
    const parts = text.split('\n\n');
    const remaining = parts.pop() || '';

    for (const part of parts) {
      if (!part.trim()) continue;

      const event: SSEEvent = {};
      const lines = part.split('\n');

      for (const line of lines) {
        if (line.startsWith('id:')) {
          event.id = line.substring(3).trim();
        } else if (line.startsWith('data:')) {
          event.data = (event.data || '') + line.substring(5).trim();
        }
      }

      if (event.data || event.id) {
        events.push(event);
      }
    }

    return { events, remaining };
  }
}
