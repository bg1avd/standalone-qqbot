/**
 * Lightweight retry helper with exponential backoff.
 */

import { log } from "./logger.js"

export interface RetryOptions {
  retries?: number
  delayMs?: number
  backoffMultiplier?: number
  maxDelayMs?: number
  onRetry?: (err: Error, attempt: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  retries: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
  onRetry: () => {},
}

/**
 * Retry an async function with exponential backoff.
 * Returns the result of the successful call, or throws the last error.
 */
export async function httpRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < opts.retries) {
        const delay = Math.min(
          opts.delayMs * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelayMs
        )
        log.gateway.debug(`Retry attempt ${attempt + 1}/${opts.retries} after ${delay}ms: ${lastError.message}`)
        opts.onRetry(lastError, attempt + 1)
        await sleep(delay)
      }
    }
  }

  throw lastError!
}

/**
 * Simple delay helper.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}