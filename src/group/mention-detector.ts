/**
 * Mention Detector — 群组 @检测
 *
 * 检测消息是否 @了机器人：
 * 1. mentions[].is_you === true（最可靠）
 * 2. eventType === "GROUP_AT_MESSAGE_CREATE"（QQ 平台级事件）
 * 3. mentionPatterns 正则匹配（ fallback，如 "@bot-name"）
 *
 * 参考：OpenClaw QQBot 的 mention.ts
 */

import type { QueuedMessage } from "../types/index.js"
import { log } from "../utils/logger.js"

const MENTION_TAG_RE = /<@!?\w+>/

export interface MentionDetectionInput {
  mentions?: QueuedMessage["mentions"]
  eventType?: QueuedMessage["eventType"]
  content: string
  mentionPatterns?: string[]
}

/**
 * 检测消息是否 @了机器人
 */
export function detectWasMentioned(input: MentionDetectionInput): boolean {
  const { mentions, eventType, content, mentionPatterns = [] } = input

  // 1. mentions[].is_you === true（最可靠）
  if (mentions?.some((m) => m.is_you)) {
    log.group.debug?.(`Mention detected: is_you=true`)
    return true
  }

  // 2. eventType === "GROUP_AT_MESSAGE_CREATE"（QQ 平台级）
  if (eventType === "GROUP_AT_MESSAGE_CREATE") {
    log.group.debug?.(`Mention detected: event type is GROUP_AT_MESSAGE_CREATE`)
    return true
  }

  // 3. mentionPatterns 正则匹配
  for (const pattern of mentionPatterns) {
    if (!pattern) continue
    try {
      const re = new RegExp(pattern, "i")
      if (re.test(content)) {
        log.group.debug?.(`Mention detected: pattern match "${pattern}"`)
        return true
      }
    } catch {
      // Invalid pattern, skip
    }
  }

  return false
}

/**
 * 检测是否有任何 @mention（不一定是 @机器人）
 */
export function hasAnyMention(input: Pick<MentionDetectionInput, "mentions" | "content">): boolean {
  const { mentions, content } = input

  if (mentions && mentions.length > 0) return true
  if (content && MENTION_TAG_RE.test(content)) return true

  return false
}

/**
 * 检测隐式 @（引用了机器人的消息）
 *
 * 当用户引用了机器人之前的消息时，视为隐式 @。
 * 需要查询 RefIndex 来判断被引用的消息是否是机器人发送的。
 */
export function resolveImplicitMention(params: {
  refMsgIdx?: string
  getRefEntry: (msgIdx: string) => { isBot?: boolean } | undefined
}): boolean {
  const { refMsgIdx, getRefEntry } = params

  if (!refMsgIdx) return false

  const entry = getRefEntry(refMsgIdx)
  if (entry?.isBot === true) {
    log.group.debug?.(`Implicit mention detected: replying to bot message`)
    return true
  }

  return false
}