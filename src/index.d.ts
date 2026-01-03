/**
 * Type declarations for runtime globals
 * Separated from main file to avoid webpack parsing issues
 * These are available in React Native and Node.js environments
 */

declare const require: {
  (id: string): any;
};

declare const console: {
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  log(...args: unknown[]): void;
};

declare function setTimeout(callback: () => void, delay: number): number;
declare function clearTimeout(timeoutId: number): void;

