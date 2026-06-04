/**
 * Content Parser — QQ Emoji 标签和 Mention 标签解析
 *
 * - `<faceType=101 faceName=微笑>` → `[Emoji: 微笑]`
 * - `<@!openid>` → `@nickname` (群聊清理)
 * - `<@openid>` → `@nickname` (私聊替换)
 */

import type { Mention } from "../types/index.js"
import { log } from "../utils/logger.js"

/** QQ Emoji 标签正则 */
const FACE_TAG_RE = /<faceType=(\d+)\s+faceName=([^>]+)>/g

/** Mention 标签正则 `<@!?\w+>` */
const MENTION_TAG_RE = /<@!?\w+>/g

/**
 * 解析 QQ Emoji 标签 → `[Emoji: name]`
 */
export function parseFaceTags(content: string): string {
  return content.replace(FACE_TAG_RE, (_, type, name) => {
    return `[Emoji: ${name}]`
  })
}

/**
 * 清理群聊中的 mention 标签
 * - 机器人自己的 mention (`is_you=true`) → 直接移除
 * - 其他人的 mention → 替换为 `@nickname`
 */
export function stripMentionText(text: string, mentions: Mention[]): string {
  if (!text || !mentions?.length) return text

  let cleaned = text

  for (const m of mentions) {
    const openid = m.member_openid ?? m.id ?? m.user_openid
    if (!openid) continue

    const tagRe = new RegExp(`<@!?${escapeRegex(openid)}>`, "g")

    if (m.is_you) {
      // 机器人自己的 mention → 移除
      cleaned = cleaned.replace(tagRe, "").trim()
      log.group.debug?.(`Stripped bot mention tag for ${openid}`)
    } else {
      // 其他人 → 替换为 @nickname
      const displayName = m.nickname ?? m.username
      if (displayName) {
        cleaned = cleaned.replace(tagRe, `@${displayName}`)
        log.group.debug?.(`Replaced mention tag for ${openid} with @${displayName}`)
      }
    }
  }

  return cleaned
}

/**
 * 私聊中替换 mention 标签为 nickname（尽力而为）
 */
export function replaceMentionsWithNicknames(text: string, mentions: Mention[]): string {
  if (!text || !mentions?.length) return text

  let out = text
  for (const m of mentions) {
    if (m.member_openid && (m.username || m.nickname)) {
      const name = m.nickname ?? m.username
      const tagRe = new RegExp(`<@${escapeRegex(m.member_openid)}>`, "g")
      out = out.replace(tagRe, `@${name}`)
    }
  }

  return out
}

/** 转义正则特殊字符 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/**
 * 解析完整的用户可见内容
 * 1. Emoji 标签解析
 * 2. Mention 清理/替换
 */
export function parseUserContent(params: {
  content: string
  type: "c2c" | "dm" | "group" | "guild"
  mentions?: Mention[]
}): string {
  const { content, type, mentions = [] } = params

  // 1. Emoji 解析
  let parsed = parseFaceTags(content)

  // 2. Mention 处理
  if (type === "group" || type === "guild") {
    parsed = stripMentionText(parsed, mentions)
  } else {
    parsed = replaceMentionsWithNicknames(parsed, mentions)
  }

  return parsed
}