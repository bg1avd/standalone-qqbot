/**
 * Lightweight retry helper with exponential backoff.
 */
import { log } from "./logger.js";
const DEFAULT_OPTIONS = {
    retries: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 30_000,
    onRetry: () => { },
};
/**
 * Retry an async function with exponential backoff.
 * Returns the result of the successful call, or throws the last error.
 */
export async function httpRetry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError;
    for (let attempt = 0; attempt <= opts.retries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < opts.retries) {
                const delay = Math.min(opts.delayMs * Math.pow(opts.backoffMultiplier, attempt), opts.maxDelayMs);
                log.gateway.debug(`Retry attempt ${attempt + 1}/${opts.retries} after ${delay}ms: ${lastError.message}`);
                opts.onRetry(lastError, attempt + 1);
                await sleep(delay);
            }
        }
    }
    throw lastError;
}
/**
 * Simple delay helper.
 */
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
//# sourceMappingURL=retry.js.map