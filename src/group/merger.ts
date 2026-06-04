/**
 * Message Merger — 群组消息合并
 *
 * 将同个群组的多个排队消息合并为一个 AI turn，格式：
 * [Merged earlier messages — CONTEXT ONLY]
 * [用户 1]: 消息 1
 * [用户 2]: 消息 2
 * [CURRENT MESSAGE — reply using the context above]
 * [当前用户]: 当前消息 (@you)
 *
 * 参考：OpenClaw QQBot 的 merger.ts / history.ts
 */

import type { QueuedMessage } from "../types/index.js"
import { log } from "../utils/logger.js"

const MERGED_CTX_START = "[Merged earlier messages — CONTEXT ONLY]"
const MERGED_CTX_END = "[CURRENT MESSAGE — reply using the context above]"

export interface MergedMessage {
  content: string
  senderName?: string
  senderId: string
  type: QueuedMessage["type"]
  mentions?: QueuedMessage["mentions"]
  attachments?: QueuedMessage["attachments"]
}

/**
 * 检测消息是否应该被合并
 *
 * 合并条件：
 * - 同个群组 (groupOpenid 相同)
 * - 时间间隔 < 5 秒
 * - 队列中有多个消息
 */
export function shouldMergeMessages(
  messages: QueuedMessage[],
  groupOpenid: string,
  mergeWindowMs: number = 5000
): boolean {
  if (messages.length < 2) return false

  const groupMessages = messages.filter((m) => m.groupOpenid === groupOpenid)
  if (groupMessages.length < 2) return false

  // 检查时间间隔
  const latest = groupMessages[groupMessages.length - 1]
  const earliest = groupMessages[0]
  const timeDiff = latest.timestamp - earliest.timestamp

  return timeDiff < mergeWindowMs
}

/**
 * 合并多个群消息为一个 AI turn
 *
 * @param messages - 待合并的消息列表（按时间顺序）
 * @param atYouTag - 当前消息是否有 @you 标记
 * @returns 合并后的完整消息体
 */
export function mergeGroupMessages(
  messages: QueuedMessage[],
  atYouTag: boolean = false
): string {
  if (messages.length === 0) return ""
  if (messages.length === 1) {
    const m = messages[0]
    const atTag = atYouTag ? " (@you)" : ""
    return `[${m.senderName ?? m.senderId}] ${m.content}${atTag}`
  }

  // 多条消息：构建合并上下文
  const preceding = messages.slice(0, -1)
  const lastMsg = messages[messages.length - 1]

  const precedingParts = preceding.map((m) => formatSubMessage(m))
  const atTag = atYouTag ? " (@you)" : ""
  const lastPart = formatSubMessage(lastMsg) + atTag

  const lines = [
    MERGED_CTX_START,
    ...precedingParts,
    MERGED_CTX_END,
    lastPart,
  ]

  log.group.debug?.(`Merged ${messages.length} messages for group ${messages[0].groupOpenid}`)
  return lines.join("\n")
}

/**
 * 格式化单条子消息
 */
function formatSubMessage(msg: QueuedMessage): string {
  let content = msg.content

  // 添加附件描述
  if (msg.attachments?.length) {
    const attDesc = msg.attachments
      .map((att) => {
        const ct = (att.content_type ?? "").toLowerCase()
        if (ct.startsWith("image/")) return `[Image: ${att.filename ?? "attachment"}]`
        if (ct === "voice" || ct.startsWith("audio/")) {
          return att.asr_refer_text ? `[Voice: "${att.asr_refer_text}"]` : `[Voice message]`
        }
        if (ct.startsWith("video/")) return `[Video: ${att.filename ?? "attachment"}]`
        return `[File: ${att.filename ?? "attachment"}]`
      })
      .join(" ")
    content = content ? `${content} ${attDesc}` : attDesc
  }

  // Mention 清理
  if (msg.mentions?.length && msg.type === "group") {
    content = stripMentionText(content, msg.mentions)
  }

  const senderLabel = msg.senderName ? `${msg.senderName} (${msg.senderId})` : msg.senderId
  return `[${senderLabel}] ${content}`
}

/**
 * 清理 mention 标签
 */
function stripMentionText(text: string, mentions: QueuedMessage["mentions"]): string {
  if (!text || !mentions?.length) return text

  let cleaned = text
  for (const m of mentions) {
    const openid = m.member_openid ?? m.id ?? m.user_openid
    if (!openid) continue

    const tagRe = new RegExp(`<@!?${escapeRegex(openid)}>`, "g")

    if (m.is_you) {
      cleaned = cleaned.replace(tagRe, "").trim()
    } else {
      const displayName = m.nickname ?? m.username
      if (displayName) {
        cleaned = cleaned.replace(tagRe, `@${displayName}`)
      }
    }
  }

  return cleaned
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}