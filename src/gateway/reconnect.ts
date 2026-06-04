/**
 * Reconnection state machine for WebSocket Gateway.
 *
 * Handles QQ's specific close codes and computes exponential backoff delays.
 */

import { log } from "../utils/logger.js"

// QQ Gateway close codes
export const GatewayCloseCode = {
  NORMAL: 1000,
  ABNORMAL: 1006,
  INSUFFICIENT_INTENTS: 4914,
  DISALLOWED_INTENTS: 4915,
  AUTH_FAILED: 4004,
  RATE_LIMITED: 4008,
  INVALID_SESSION: 4006,
  SEQ_OUT_OF_RANGE: 4007,
  SESSION_TIMEOUT: 4009,
  SERVER_ERROR_START: 5000,
  SERVER_ERROR_END: 5999,
} as const

// Reconnect delays: [1s, 2s, 5s, 10s, 30s, 60s] — matches OpenClaw QQBot
const RECONNECT_DELAYS = [1_000, 2_000, 5_000, 10_000, 30_000, 60_000]
const RATE_LIMIT_DELAY = 60_000
const MAX_ATTEMPTS = 100
const QUICK_DISCONNECT_THRESHOLD = 5_000 // 5s
const QUICK_DISCONNECT_LIMIT = 3

export interface CloseAction {
  shouldReconnect: boolean
  reconnectDelay?: number  // ms, overrides computed delay
  clearSession: boolean
  refreshToken: boolean
  fatal: boolean
  reason: string
}

export class ReconnectState {
  private attempts = 0
  private lastConnectTime = 0
  private quickDisconnectCount = 0

  constructor(private accountId: string) {}

  /** Call when WebSocket successfully connects */
  onConnected(): void {
    this.attempts = 0
    this.lastConnectTime = Date.now()
    this.quickDisconnectCount = 0
  }

  isExhausted(): boolean {
    return this.attempts >= MAX_ATTEMPTS
  }

  getNextDelay(customDelay?: number): number {
    const delay = customDelay ?? RECONNECT_DELAYS[Math.min(this.attempts, RECONNECT_DELAYS.length - 1)]
    this.attempts++
    log.gateway.debug(`[reconnect:%s] Reconnecting in %dms (attempt %d/%d)`, this.accountId, delay, this.attempts, MAX_ATTEMPTS)
    return delay
  }

  handleClose(code: number, isAborted: boolean): CloseAction {
    // Fatal: bot is banned or missing intents
    if (code === GatewayCloseCode.INSUFFICIENT_INTENTS) {
      return { shouldReconnect: false, clearSession: false, refreshToken: false, fatal: true, reason: "offline/sandbox-only — insufficient intents" }
    }
    if (code === GatewayCloseCode.DISALLOWED_INTENTS) {
      return { shouldReconnect: false, clearSession: false, refreshToken: false, fatal: true, reason: "banned by QQ platform" }
    }

    // Auth failure → refresh token and reconnect
    if (code === GatewayCloseCode.AUTH_FAILED) {
      log.gateway.info(`[reconnect:%s] Token invalid (4004), will refresh and reconnect`, this.accountId)
      return { shouldReconnect: !isAborted, clearSession: false, refreshToken: true, fatal: false, reason: "invalid token (4004)" }
    }

    // Rate limited → fixed 60s wait
    if (code === GatewayCloseCode.RATE_LIMITED) {
      log.gateway.info(`[reconnect:%s] Rate limited (4008), waiting %dms`, this.accountId, RATE_LIMIT_DELAY)
      return { shouldReconnect: !isAborted, reconnectDelay: RATE_LIMIT_DELAY, clearSession: false, refreshToken: false, fatal: false, reason: "rate limited (4008)" }
    }

    // Invalid session / seq out of range / session timeout → clear session and re-identify
    if (
      code === GatewayCloseCode.INVALID_SESSION ||
      code === GatewayCloseCode.SEQ_OUT_OF_RANGE ||
      code === GatewayCloseCode.SESSION_TIMEOUT
    ) {
      const reasonMap: Record<number, string> = {
        [GatewayCloseCode.INVALID_SESSION]: "session no longer valid",
        [GatewayCloseCode.SEQ_OUT_OF_RANGE]: "invalid seq on resume",
        [GatewayCloseCode.SESSION_TIMEOUT]: "session timed out",
      }
      log.gateway.info(`[reconnect:%s] Close %d (%s), will re-identify`, this.accountId, code, reasonMap[code])
      return { shouldReconnect: !isAborted, clearSession: true, refreshToken: true, fatal: false, reason: reasonMap[code] }
    }

    // Server error (5xxx) → re-identify
    if (code >= GatewayCloseCode.SERVER_ERROR_START && code <= GatewayCloseCode.SERVER_ERROR_END) {
      log.gateway.info(`[reconnect:%s] Server error %d, will re-identify`, this.accountId, code)
      return { shouldReconnect: !isAborted && code !== GatewayCloseCode.NORMAL, clearSession: true, refreshToken: true, fatal: false, reason: `server error (${code})` }
    }

    // Check for rapid disconnects (possible permission issue)
    const duration = Date.now() - this.lastConnectTime
    if (duration < QUICK_DISCONNECT_THRESHOLD && this.lastConnectTime > 0) {
      this.quickDisconnectCount++
      log.gateway.debug(`[reconnect:%s] Quick disconnect detected (%dms), count: %d`, this.accountId, duration, this.quickDisconnectCount)
      if (this.quickDisconnectCount >= QUICK_DISCONNECT_LIMIT) {
        log.gateway.error(`[reconnect:%s] Too many quick disconnects — possible permission issue`, this.accountId)
        this.quickDisconnectCount = 0
        return {
          shouldReconnect: !isAborted && code !== GatewayCloseCode.NORMAL,
          reconnectDelay: RATE_LIMIT_DELAY,
          clearSession: false,
          refreshToken: false,
          fatal: false,
          reason: "too many quick disconnects",
        }
      }
    } else {
      this.quickDisconnectCount = 0
    }

    // Normal close or unknown code
    return {
      shouldReconnect: !isAborted && code !== GatewayCloseCode.NORMAL,
      clearSession: false,
      refreshToken: false,
      fatal: false,
      reason: `close code ${code}`,
    }
  }
}