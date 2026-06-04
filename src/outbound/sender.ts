/**
 * Outbound Text Sender — 文本消息发送
 *
 * 调用 QQ 开放平台 REST API 发送文本消息。
 * 支持引用回复（msgId 参数）。
 *
 * API:
 * - C2C: POST /v2/users/{openid}/messages
 * - Group: POST /v2/groups/{group_openid}/messages
 * - Guild: POST /channels/{channel_id}/messages
 *
 * 参考：OpenClaw QQBot 的 sender-p-B14eLG.js
 */

import { log } from "../utils/logger.js"
import type { SendResult, SendTargetType } from "../types/index.js"

const API_BASE = "https://api.q.qq.com"

export interface SendTextOptions {
  /** 回复的消息 ID */
  msgId?: string
  /** 是否使用 markdown 格式 */
  markdown?: boolean
}

/**
 * 发送文本消息
 */
export async function sendText(
  appId: string,
  accessToken: string,
  targetType: SendTargetType,
  targetId: string,
  content: string,
  options: SendTextOptions = {}
): Promise<SendResult> {
  const url = buildMessageUrl(targetType, targetId)
  if (!url) {
    log.outbound.error(`Unsupported target type: ${targetType}`)
    return { channel: "qqbot", error: `Unsupported target type: ${targetType}` }
  }

  const body: any = {
    msg_type: options.markdown ? 2 : 0, // 0=text, 2=markdown
    content,
  }

  if (options.msgId) {
    body.msg_id = options.msgId
    body.event_id = options.msgId
  }

  try {
    log.outbound.debug(`Sending text to ${targetType}:${targetId}`)

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `QQBot ${accessToken}`,
        "X-Union-Appid": appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "")
      log.outbound.error(`Send failed: HTTP ${resp.status} — ${errorText.slice(0, 200)}`)
      return {
        channel: "qqbot",
        error: `HTTP ${resp.status}: ${errorText.slice(0, 100)}`,
      }
    }

    const data = await resp.json() as {
      id?: string
      message_id?: string
      timestamp?: string
    }

    const messageId = data.id ?? data.message_id
    const timestamp = data.timestamp ? new Date(data.timestamp).getTime() : Date.now()

    log.outbound.info(`Text sent: messageId=${messageId}`)
    return {
      channel: "qqbot",
      messageId,
      timestamp,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.outbound.error(`Send failed: ${msg}`)
    return {
      channel: "qqbot",
      error: msg,
    }
  }
}

function buildMessageUrl(targetType: SendTargetType, targetId: string): string | null {
  switch (targetType) {
    case "c2c":
      return `${API_BASE}/v2/users/${targetId}/messages`
    case "group":
      return `${API_BASE}/v2/groups/${targetId}/messages`
    case "channel":
      return `${API_BASE}/channels/${targetId}/messages`
    case "dm":
      // DM uses guild_id + channel_id, but we simplify to channel
      return `${API_BASE}/channels/${targetId}/messages`
    default:
      return null
  }
}