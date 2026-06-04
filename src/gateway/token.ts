/**
 * Token Manager — 获取并自动刷新 QQ Open Platform access_token
 *
 * QQ access_token 有效期 24 小时，SDK 在启动时获取，
 * 并在剩余 5 分钟时自动刷新。后台有一个定时刷新线程。
 */

import { log } from "../utils/logger.js"
import { httpRetry } from "../utils/retry.js"

const TOKEN_URL = "https://api.q.qq.com"
const TOKEN_PATH = "/app/token"
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000     // 24h
const TOKEN_REFRESH_AHEAD_MS = 5 * 60 * 1000  // 提前 5 分钟刷新
const TOKEN_RETRY_DELAY_MS = 30_000           // 获取失败重试间隔

export interface TokenInfo {
  accessToken: string
  expiresAt: number   // Unix ms timestamp
}

type TokenChangeCallback = (token: string) => void

interface TokenEntry {
  token: string
  expiresAt: number
  refreshTimer: ReturnType<typeof setTimeout> | null
  retryTimer: ReturnType<typeof setInterval> | null
}

/** 全局 token 存储，key = appId */
const tokenStore = new Map<string, TokenEntry>()

/**
 * 获取有效 token（从缓存或重新获取）。
 * 内部使用，外部通过 startBackgroundTokenRefresh() 启动自动刷新。
 */
export async function getAccessToken(
  appId: string,
  clientSecret: string
): Promise<string> {
  const cached = tokenStore.get(appId)
  if (cached && Date.now() < cached.expiresAt - TOKEN_REFRESH_AHEAD_MS) {
    log.gateway.debug("[token] Using cached token for %s (expires in %ds)", appId, Math.round((cached.expiresAt - Date.now()) / 1000))
    return cached.token
  }

  // 缓存过期或不存在，重新获取
  return await fetchNewToken(appId, clientSecret)
}

/**
 * 强制刷新 token（清除缓存后重新获取）。
 */
export async function refreshAccessToken(
  appId: string,
  clientSecret: string
): Promise<string> {
  clearTokenCache(appId)
  return await fetchNewToken(appId, clientSecret)
}

/**
 * 获取新的 access_token（HTTP 调用）。
 * 失败后抛出错误，由调用方决定是否重试。
 */
async function fetchNewToken(
  appId: string,
  clientSecret: string
): Promise<string> {
  log.gateway.info("[token] Fetching new access_token for appId=%s", appId)

  const body = new URLSearchParams({
    appId,
    clientSecret,
    grant_type: "client_credentials",
  })

  const resp = await httpRetry(
    () =>
      fetch(`${TOKEN_URL}${TOKEN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }),
    { retries: 3, delayMs: 2000 }
  )

  if (!resp.ok) {
    const text = await resp.text().catch(() => "")
    throw new Error(`Failed to get access_token: HTTP ${resp.status} — ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as {
    access_token?: string
    expires_in?: number  // 秒
    code?: number
    message?: string
  }

  if (data.code !== undefined && data.code !== 0) {
    throw new Error(`QQ API error getting token: code=${data.code} msg=${data.message}`)
  }

  const token = data.access_token
  if (!token) {
    throw new Error("QQ API returned no access_token")
  }

  const expiresInMs = (data.expires_in ?? Math.floor(TOKEN_TTL_MS / 1000)) * 1000
  const expiresAt = Date.now() + expiresInMs

  // 更新缓存
  const entry: TokenEntry = {
    token,
    expiresAt,
    refreshTimer: null,
    retryTimer: null,
  }
  tokenStore.set(appId, entry)

  log.gateway.info("[token] Got new token for appId=%s (expires in %ds)", appId, Math.round(expiresInMs / 1000))
  return token
}

/**
 * 清除 token 缓存（强制下次重新获取）。
 */
export function clearTokenCache(appId: string): void {
  const entry = tokenStore.get(appId)
  if (entry) {
    if (entry.refreshTimer) clearTimeout(entry.refreshTimer)
    if (entry.retryTimer) clearInterval(entry.retryTimer)
    tokenStore.delete(appId)
    log.gateway.debug("[token] Cleared cached token for %s", appId)
  }
}

/**
 * 启动后台 token 刷新线程。
 * 启动后自动在过期前刷新，并在刷新成功后调用 onRefresh 回调。
 */
export function startBackgroundTokenRefresh(
  appId: string,
  clientSecret: string,
  callbacks?: {
    onRefresh?: TokenChangeCallback
    onError?: (err: Error) => void
  }
): void {
  stopBackgroundTokenRefresh(appId) // 先清理旧的

  const scheduleRefresh = (delayMs: number) => {
    const entry = tokenStore.get(appId)
    if (!entry) return

    if (entry.refreshTimer) clearTimeout(entry.refreshTimer)
    entry.refreshTimer = setTimeout(async () => {
      try {
        const newToken = await refreshAccessToken(appId, clientSecret)
        callbacks?.onRefresh?.(newToken)
        // 刷新成功后安排下一次
        scheduleRefresh(TOKEN_TTL_MS)
      } catch (err) {
        log.gateway.error("[token] Background refresh failed: %s", err instanceof Error ? err.message : String(err))
        callbacks?.onError?.(err instanceof Error ? err : new Error(String(err)))
        // 刷新失败，30 秒后重试
        scheduleRefresh(TOKEN_RETRY_DELAY_MS)
      }
    }, delayMs)
  }

  // 立即安排（基于当前 token 的过期时间）
  const entry = tokenStore.get(appId)
  if (entry) {
    const delay = entry.expiresAt - TOKEN_REFRESH_AHEAD_MS - Date.now()
    scheduleRefresh(Math.max(delay, 0))
  }
}

/**
 * 停止后台 token 刷新线程。
 */
export function stopBackgroundTokenRefresh(appId: string): void {
  const entry = tokenStore.get(appId)
  if (entry) {
    if (entry.refreshTimer) clearTimeout(entry.refreshTimer)
    if (entry.retryTimer) clearInterval(entry.retryTimer)
    entry.refreshTimer = null
    entry.retryTimer = null
  }
}

/**
 * 清理所有 token（退出时调用）。
 */
export function flushAllTokens(): void {
  for (const appId of tokenStore.keys()) {
    stopBackgroundTokenRefresh(appId)
    tokenStore.delete(appId)
  }
}