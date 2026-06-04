/**
 * Lightweight retry helper with exponential backoff.
 */
export interface RetryOptions {
    retries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    maxDelayMs?: number;
    onRetry?: (err: Error, attempt: number) => void;
}
/**
 * Retry an async function with exponential backoff.
 * Returns the result of the successful call, or throws the last error.
 */
export declare function httpRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T>;
/**
 * Simple delay helper.
 */
export declare function sleep(ms: number): Promise<void>;
//# sourceMappingURL=retry.d.ts.map