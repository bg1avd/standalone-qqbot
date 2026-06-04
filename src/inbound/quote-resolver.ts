/**
 * Quote Resolver — 引用消息解析
 *
 * 根据 refMsgIdx 解析引用的消息内容：
 * 1. 优先从 RefIndex 缓存读取
 * 2. 回退：从 msg_elements[0] 直接解析
 * 3. 再回退：返回 id-only placeholder
 *
 * 参考：OpenClaw QQBot 的 quote-stage.ts
 */

import type { ReplyToInfo, QueuedMessage } from "../types/index.js"
import { getRefIndex } from "./ref-index.js"
import { log } from "../utils/logger.js"

/** 格式化引用条目为人类可读文本 */
export function formatRefEntryForAgent(entry: {
  content?: string
  senderId?: string
  senderName?: string
  timestamp?: number
  attachments?: Array<{
    type: string
    filename?: string
    transcript?: string
  }>
}): string {
  const parts: string[] = []

  // Sender
  const sender = entry.senderName ?? entry.senderId ?? "Unknown"
  parts.push(`[Reply to ${sender}]`)

  // Content
  if (entry.content && entry.content.trim()) {
    parts.push(entry.content.trim().slice(0, 200))
  }

  // Attachments
  if (entry.attachments?.length) {
    const attDesc = entry.attachments
      .map((att) => {
        if (att.type === "image") return `[Image: ${att.filename ?? "attachment"}]`
        if (att.type === "voice") {
          if (att.transcript) return `[Voice: "${att.transcript}"]`
          return `[Voice message]`
        }
        if (att.type === "video") return `[Video: ${att.filename ?? "attachment"}]`
        return `[File: ${att.filename ?? "attachment"}]`
      })
      .join(" ")
    parts.push(attDesc)
  }

  const result = parts.join(" ")
  return result || "[empty message]"
}

/**
 * 解析引用消息
 *
 * @param event - 原始 QQ 事件
 * @returns ReplyToInfo 或 undefined（非引用消息）
 */
export async function resolveQuote(event: Pick<QueuedMessage, "refMsgIdx" | "msgType" | "msgElements">): Promise<ReplyToInfo | undefined> {
  if (!event.refMsgIdx) {
    return undefined
  }

  // 1. 尝试从 RefIndex 缓存读取
  const refEntry = getRefIndex(event.refMsgIdx)
  if (refEntry) {
    log.inbound.debug(`Quote resolved from refIndex cache: refMsgIdx=${event.refMsgIdx}`)
    return {
      id: event.refMsgIdx,
      body: formatRefEntryForAgent(refEntry),
      sender: refEntry.senderName ?? refEntry.senderId,
      isQuote: true,
    }
  }

  // 2. 回退：从 msg_elements[0] 解析
  if (event.msgType === 103 && event.msgElements?.[0]) {
    try {
      const refElement = event.msgElements[0]
      const refContent = refElement.content ?? ""
      const refAttachments = refElement.attachments ?? []

      const bodyParts: string[] = []
      if (refContent.trim()) bodyParts.push(refContent.trim())

      if (refAttachments.length > 0) {
        const attDesc = refAttachments
          .map((att: any) => {
            const type = att.content_type?.toLowerCase() ?? ""
            if (type.startsWith("image/")) return `[Image]`
            if (type === "voice" || type.startsWith("audio/")) {
              const transcript = att.asr_refer_text
              return transcript ? `[Voice: "${transcript}"]` : `[Voice message]`
            }
            if (type.startsWith("video/")) return `[Video]`
            return `[File: ${att.filename ?? "attachment"}]`
          })
          .join(" ")
        bodyParts.push(attDesc)
      }

      const body = bodyParts.join(" ") || "[empty message]"
      log.inbound.debug(`Quote resolved from msg_elements: refMsgIdx=${event.refMsgIdx}`)

      return {
        id: event.refMsgIdx,
        body,
        isQuote: true,
      }
    } catch (err) {
      log.inbound.error(`Failed to parse quote from msg_elements: %s`, err instanceof Error ? err.message : String(err))
    }
  }

  // 3. 回退：id-only placeholder
  log.inbound.debug(`Quote detected but no content available: refMsgIdx=${event.refMsgIdx}`)
  return {
    id: event.refMsgIdx,
    isQuote: true,
  }
}