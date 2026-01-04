/**
 * Retry Utilities
 * Helper functions for retrying operations with exponential backoff
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  multiplier?: number;
  /** Function to determine if error should be retried (default: retry all errors) */
  shouldRetry?: (error: Error) => boolean;
}

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Promise that resolves with the function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    multiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: Error | null = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if shouldRetry returns false
      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retrying
      await new Promise<void>((resolve) => setTimeout(() => resolve(), delay));

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * multiplier, maxDelay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error('Retry failed');
}

/**
 * Retry with custom delay function
 * @param fn - Function to retry
 * @param getDelay - Function that returns delay for each attempt (attempt number, last error)
 * @param maxAttempts - Maximum number of attempts
 * @returns Promise that resolves with the function result
 */
export async function retryWithCustomDelay<T>(
  fn: () => Promise<T>,
  getDelay: (attempt: number, error: Error | null) => number,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        throw lastError;
      }

      // Wait before retrying
      const delay = getDelay(attempt, lastError);
      await new Promise<void>((resolve) => setTimeout(() => resolve(), delay));
    }
  }

  throw lastError || new Error('Retry failed');
}

