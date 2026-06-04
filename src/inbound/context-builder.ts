/**
 * Context Builder — 8-stage 入站上下文构建流水线
 *
 * Stages:
 * 1. runAccessStage() — 权限检查
 * 2. processAttachments() — 附件下载（P2 语音暂缓）
 * 3. buildUserContent() — Emoji/Mention解析
 * 4. resolveQuote() — 引用解析
 * 5. writeRefIndex() — 引用缓存写入
 * 6. runGroupGateStage() — 群组门控（仅 group）
 * 7. buildBody/UserMessage/AgentBody — AI 输入渲染
 * 8. buildDynamicCtx() — 元信息附加
 *
 * 参考：OpenClaw QQBot 的 inbound-pipeline.ts
 */

import type {
  InboundContext,
  QueuedMessage,
  ProcessedAttachments,
  ReplyToInfo,
  GroupGateResult,
  AccessResult,
  QQBotAccountConfig,
} from "../types/index.js"
import { resolveQQBotAccess, createQQBotSenderMatcher } from "./access.js"
import { parseUserContent } from "./content-parser.js"
import { resolveQuote, formatRefEntryForAgent } from "./quote-resolver.js"
import { setRefIndex, buildRefEntryFromMessage } from "./ref-index.js"
import { log } from "../utils/logger.js"
import { tmpdir } from "os"
import { randomUUID } from "crypto"
import { writeFile, mkdir } from "fs/promises"
import { join } from "path"
import { downloadAndProcessVoice, type VoiceProcessorOptions } from "./voice-processor.js"

// ============================================================================
// Stage 1: Access Control
// ============================================================================

export function runAccessStage(event: QueuedMessage, accountConfig: QQBotAccountConfig): { kind: "block"; context: Partial<InboundContext> } | { kind: "allow"; access: AccessResult; isGroupChat: boolean; peerId: string; qualifiedTarget: string; fromAddress: string } {
  const isGroupChat = event.type === "group" || event.type === "guild"
  const peerId = resolvePeerId(event, isGroupChat)
  const qualifiedTarget = buildQualifiedTarget(event, isGroupChat)

  const access = resolveQQBotAccess({
    isGroup: isGroupChat,
    senderId: event.senderId,
    allowFrom: accountConfig.allowFrom,
    groupAllowFrom: accountConfig.groupAllowFrom,
    dmPolicy: accountConfig.dmPolicy,
    groupPolicy: accountConfig.groupPolicy,
  })

  if (access.decision !== "allow") {
    log.access.info(`Blocked inbound: decision=${access.decision} reasonCode=${access.reasonCode} senderId=${event.senderId}`)
    return {
      kind: "block",
      context: {
        event,
        isGroupChat,
        peerId,
        qualifiedTarget,
        fromAddress: qualifiedTarget,
        blocked: true,
        blockReason: access.reason,
        accessDecision: access.decision,
      },
    }
  }

  return {
    kind: "allow",
    access,
    isGroupChat,
    peerId,
    qualifiedTarget,
    fromAddress: qualifiedTarget,
  }
}

function resolvePeerId(event: QueuedMessage, isGroupChat: boolean): string {
  if (event.type === "guild") return event.channelId ?? "unknown"
  if (event.type === "group") return event.groupOpenid ?? "unknown"
  if (isGroupChat) return "unknown"
  return event.senderId
}

function buildQualifiedTarget(event: QueuedMessage, isGroupChat: boolean): string {
  if (isGroupChat) {
    return event.type === "guild" ? `qqbot:channel:${event.channelId}` : `qqbot:group:${event.groupOpenid}`
  }
  return event.type === "dm" ? `qqbot:dm:${event.guildId}` : `qqbot:c2c:${event.senderId}`
}

// ============================================================================
// Stage 2: Attachment Processing (P2 语音暂缓)
// ============================================================================

export async function processAttachments(
  attachments: QueuedMessage["attachments"],
  options?: { downloadImages?: boolean; dataDir?: string; enableVoiceProcessing?: boolean; sttApiKey?: string }
): Promise<ProcessedAttachments> {
  const result: ProcessedAttachments = {
    attachmentInfo: "",
    imageUrls: [],
    imageMediaTypes: [],
    voiceAttachmentPaths: [],
    voiceAttachmentUrls: [],
    voiceAsrReferTexts: [],
    voiceTranscripts: [],
    voiceTranscriptSources: [],
    voiceDecodedWavPaths: [],
    attachmentLocalPaths: [],
  }

  if (!attachments?.length) {
    return result
  }

  const imageParts: string[] = []
  const fileParts: string[] = []
  const voiceParts: string[] = []

  // 确保临时目录存在
  const dataDir = options?.dataDir ?? join(tmpdir(), "standalone-qqbot-voice")
  try {
    await mkdir(dataDir, { recursive: true })
  } catch {
    // ignore
  }

  for (const att of attachments) {
    const contentType = (att.content_type ?? "").toLowerCase()

    if (contentType.startsWith("image/")) {
      result.imageUrls.push(att.url)
      result.imageMediaTypes.push(att.content_type ?? "image/png")
      if (options?.downloadImages) {
        // TODO: implement image download (P2)
      }
      imageParts.push(`[Image: ${att.filename ?? "attachment"}]`)
    } else if (contentType === "voice" || contentType.startsWith("audio/")) {
      const voiceUrl = att.voice_wav_url ?? att.url
      result.voiceAttachmentUrls.push(voiceUrl)

      if (att.asr_refer_text) {
        // QQ 平台已提供 ASR 转写
        result.voiceAsrReferTexts.push(att.asr_refer_text)
        result.voiceTranscripts.push(att.asr_refer_text)
        result.voiceTranscriptSources.push("asr")
        voiceParts.push(`[Voice: "${att.asr_refer_text}"]`)
      } else if (options?.enableVoiceProcessing) {
        // Phase 2.3: 下载并处理语音（解码 + 可选 STT）
        try {
          log.voice.info(`Processing voice from: ${voiceUrl}`)
          const processed = await downloadAndProcessVoice(voiceUrl, {
            enableSTT: !!options.sttApiKey,
            sttApiKey: options.sttApiKey,
          })

          // 保存解码后的 WAV 到临时文件
          if (processed.wavBuffer) {
            const wavFilename = `voice-${randomUUID()}.wav`
            const wavPath = join(dataDir, wavFilename)
            await writeFile(wavPath, processed.wavBuffer)
            result.voiceDecodedWavPaths.push(wavPath)
            log.voice.debug(`Saved decoded WAV: ${wavPath}`)
          }

          // 如果有转写结果
          if (processed.transcript) {
            result.voiceTranscripts.push(processed.transcript)
            result.voiceTranscriptSources.push("silk-wasm+stt")
            voiceParts.push(`[Voice: "${processed.transcript}"]`)
          } else {
            voiceParts.push("[Voice message]") // 有解码但无转写
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          log.voice.error(`Voice processing failed: ${msg}`)
          voiceParts.push("[Voice message]") // 回退
        }
      } else {
        voiceParts.push("[Voice message]")
      }
    } else if (contentType.startsWith("video/")) {
      fileParts.push(`[Video: ${att.filename ?? "attachment"}]`)
    } else {
      fileParts.push(`[File: ${att.filename ?? "attachment"}]`)
    }
  }

  const parts = [...imageParts, ...voiceParts, ...fileParts]
  if (parts.length > 0) {
    result.attachmentInfo = " " + parts.join(" ")
  }

  return result
}

// ============================================================================
// Stage 3: Build User Content
// ============================================================================

export function buildUserContent(event: QueuedMessage, processed: ProcessedAttachments): { parsedContent: string; userContent: string } {
  const parsedContent = parseUserContent({
    content: event.content,
    type: event.type,
    mentions: event.mentions,
  })

  let userContent = parsedContent + processed.attachmentInfo

  return { parsedContent, userContent }
}

// ============================================================================
// Stage 6: Group Gate
// ============================================================================

export interface GroupGateInput {
  event: QueuedMessage
  userContent: string
  accountConfig: QQBotAccountConfig
  agentId?: string
  sessionStoreReader?: (key: string) => any
}

export function runGroupGateStage(input: GroupGateInput): { kind: "pass"; groupInfo: GroupGateResult } | { kind: "skip"; groupInfo: GroupGateResult; skipReason: string } | null {
  const { event, accountConfig } = input
  if (event.type !== "group" || !event.groupOpenid) return null

  const groupOpenid = event.groupOpenid
  const groupConfig: any = resolveGroupConfig(accountConfig, groupOpenid)

  const { requireMention, ignoreOtherMentions } = groupConfig
  const groupName = groupConfig.name || groupOpenid.slice(0, 8)
  const senderLabel = event.senderName ? `${event.senderName} (${event.senderId})` : event.senderId

  // 检测 mention
  const explicitWasMentioned = detectWasMentioned(event)
  const anyMention = hasAnyMention(event)
  const implicitMention = resolveImplicitMention(event)

  // 门控决策
  let gateAction: GroupGateResult["gate"]["action"] = "pass"
  let effectiveWasMentioned = explicitWasMentioned || implicitMention

  // Layer 1: ignoreOtherMentions
  if (ignoreOtherMentions && anyMention && !explicitWasMentioned && !implicitMention) {
    gateAction = "drop_other_mention"
    effectiveWasMentioned = false
  }
  // Layer 2: requireMention
  else if (requireMention && !explicitWasMentioned && !implicitMention) {
    gateAction = "skip_no_mention"
    effectiveWasMentioned = false
  }

  const groupInfo: GroupGateResult = {
    gate: {
      action: gateAction,
      effectiveWasMentioned,
      shouldBypassMention: false,
    },
    activation: requireMention ? "mention" : "always",
    historyLimit: groupConfig.historyLimit ?? 50,
    isMerged: false, // 消息合并待实现
    display: {
      groupName,
      senderLabel,
      behaviorPrompt: groupConfig.prompt,
    },
  }

  if (gateAction === "pass") {
    return { kind: "pass", groupInfo }
  }

  log.group.debug?.(`Group gate: action=${gateAction} group=${groupOpenid}`)
  return { kind: "skip", groupInfo, skipReason: gateAction }
}

function resolveGroupConfig(accountConfig: QQBotAccountConfig, groupOpenid: string): Required<typeof accountConfig.groups>[number] {
  const groups = accountConfig.groups ?? {}
  const wildcard = groups["*"] ?? {}
  const specific = groups[groupOpenid] ?? {}

  return {
    requireMention: specific.requireMention ?? wildcard.requireMention ?? true,
    ignoreOtherMentions: specific.ignoreOtherMentions ?? wildcard.ignoreOtherMentions ?? false,
    toolPolicy: specific.toolPolicy ?? wildcard.toolPolicy ?? "restricted",
    name: specific.name ?? wildcard.name ?? "",
    prompt: specific.prompt ?? wildcard.prompt,
    historyLimit: specific.historyLimit ?? wildcard.historyLimit ?? 50,
  }
}

function detectWasMentioned(event: QueuedMessage): boolean {
  // Check mentions[].is_you
  if (event.mentions?.some((m) => m.is_you)) return true
  // Check eventType
  if (event.eventType === "GROUP_AT_MESSAGE_CREATE") return true
  return false
}

function hasAnyMention(event: QueuedMessage): boolean {
  if (event.mentions && event.mentions.length > 0) return true
  const MENTION_TAG_RE = /<@!?\w+>/
  return MENTION_TAG_RE.test(event.content)
}

function resolveImplicitMention(event: QueuedMessage): boolean {
  // 引用了机器人的消息 → 视为已 @
  // TODO: implement ref index lookup for is_bot check
  return false
}

// ============================================================================
// Stage 7: Build Body / UserMessage / AgentBody
// ============================================================================

export function buildQuotePart(replyTo?: ReplyToInfo): string {
  if (!replyTo) return ""
  return replyTo.body ? `[Quoted message begins]\n${replyTo.body}\n[Quoted message ends]\n` : `[Quoted message begins]\nOriginal content unavailable\n[Quoted message ends]\n`
}

export function buildUserMessage(event: QueuedMessage, userContent: string, quotePart: string, groupInfo?: GroupGateResult): string {
  const isGroupChat = event.type === "group" || event.type === "guild"

  if (isGroupChat) {
    const atYouTag = groupInfo?.gate.effectiveWasMentioned ? " (@you)" : ""
    const senderPrefix = event.type === "group" ? `[${event.senderName ?? event.senderId}] ` : ""
    return `${senderPrefix}${quotePart}${userContent}${atYouTag}`
  }

  return `${quotePart}${userContent}`
}

export function buildAgentBody(
  event: QueuedMessage,
  userMessage: string,
  dynamicCtx: string
): string {
  // 斜杠命令跳过装饰
  if (userMessage.startsWith("/")) return userMessage

  const base = `${dynamicCtx}${userMessage}`
  // TODO: implement group history buffer (P2)
  return base
}

// ============================================================================
// Stage 8: Build Dynamic Context
// ============================================================================

export function buildDynamicCtx(processed: ProcessedAttachments): string {
  const lines: string[] = []

  if (processed.imageUrls.length > 0) {
    lines.push(`- Images: ${processed.imageUrls.join(", ")}`)
  }
  if (processed.voiceAttachmentUrls.length > 0) {
    lines.push(`- Voice: ${processed.voiceAttachmentUrls.join(", ")}`)
  }
  if (processed.voiceAsrReferTexts.length > 0) {
    lines.push(`- ASR: ${processed.voiceAsrReferTexts.join(" | ")}`)
  }

  return lines.length > 0 ? lines.join("\n") + "\n\n" : ""
}

// ============================================================================
// Main: Build Full Inbound Context
// ============================================================================

export async function buildInboundContext(
  event: QueuedMessage,
  accountConfig: QQBotAccountConfig
): Promise<InboundContext> {
  // Stage 1: Access
  const accessResult = runAccessStage(event, accountConfig)
  if (accessResult.kind === "block") {
    return {
      ...accessResult.context,
      parsedContent: "",
      userContent: "",
      quotePart: "",
      dynamicCtx: "",
      userMessage: "",
      agentBody: "",
      body: "",
      systemPrompts: accountConfig.systemPrompt ? [accountConfig.systemPrompt] : [],
      attachments: {
        attachmentInfo: "",
        imageUrls: [],
        imageMediaTypes: [],
        voiceAttachmentPaths: [],
        voiceAttachmentUrls: [],
        voiceAsrReferTexts: [],
        voiceTranscripts: [],
        voiceTranscriptSources: [],
        voiceDecodedWavPaths: [],
        attachmentLocalPaths: [],
      },
      localMediaPaths: [],
      localMediaTypes: [],
      remoteMediaUrls: [],
      remoteMediaTypes: [],
      uniqueVoicePaths: [],
      uniqueVoiceUrls: [],
      uniqueVoiceAsrReferTexts: [],
      voiceMediaTypes: [],
      hasAsrReferFallback: false,
      voiceTranscriptSources: [],
      commandAuthorized: false,
      skipped: false,
    } as InboundContext
  }

  const { access, isGroupChat, peerId, qualifiedTarget, fromAddress } = accessResult

  // Stage 2: Attachments (with Phase 2.3 voice processing)
  const voiceProcessingEnabled = process.env.VOICE_ENABLE_PROCESSING === 'true'
  const sttApiKey = process.env.VOICE_STT_API_KEY
  const processed = await processAttachments(event.attachments, {
    enableVoiceProcessing: voiceProcessingEnabled,
    sttApiKey: sttApiKey,
    dataDir: join(tmpdir(), "standalone-qqbot-voice"),
  })

  // Stage 3: User Content
  const { parsedContent, userContent } = buildUserContent(event, processed)

  // Stage 4: Quote
  const replyTo = await resolveQuote(event)

  // Stage 5: RefIndex
  setRefIndex(event.msgIdx ?? event.refMsgIdx ?? "", buildRefEntryFromMessage(event))

  // Stage 6: Group Gate
  let groupInfo: GroupGateResult | undefined
  if (event.type === "group" && event.groupOpenid) {
    const gateResult = runGroupGateStage({
      event,
      userContent,
      accountConfig,
    })
    if (gateResult?.kind === "skip") {
      return {
        event,
        isGroupChat,
        peerId,
        qualifiedTarget,
        fromAddress,
        parsedContent,
        userContent,
        quotePart: buildQuotePart(replyTo),
        dynamicCtx: buildDynamicCtx(processed),
        userMessage: buildUserMessage(event, userContent, buildQuotePart(replyTo), gateResult.groupInfo),
        agentBody: buildAgentBody(event, buildUserMessage(event, userContent, buildQuotePart(replyTo), gateResult.groupInfo), buildDynamicCtx(processed)),
        body: `${event.senderName ?? event.senderId}: ${userContent}`,
        systemPrompts: accountConfig.systemPrompt ? [accountConfig.systemPrompt] : [],
        attachments: processed,
        localMediaPaths: [],
        localMediaTypes: [],
        remoteMediaUrls: processed.imageUrls,
        remoteMediaTypes: processed.imageMediaTypes,
        uniqueVoicePaths: [],
        uniqueVoiceUrls: processed.voiceAttachmentUrls,
        uniqueVoiceAsrReferTexts: processed.voiceAsrReferTexts,
        voiceMediaTypes: processed.voiceAttachmentUrls.map(() => "audio/wav"),
        hasAsrReferFallback: processed.voiceTranscriptSources.includes("asr"),
        voiceTranscriptSources: processed.voiceTranscriptSources,
        replyTo,
        commandAuthorized: false,
        group: gateResult.groupInfo,
        blocked: false,
        skipped: true,
        skipReason: gateResult.skipReason,
        accessDecision: access.decision,
      }
    }
    if (gateResult?.kind === "pass") {
      groupInfo = gateResult.groupInfo
    }
  }

  // Stage 7: Body / UserMessage / AgentBody
  const quotePart = buildQuotePart(replyTo)
  const userMessage = buildUserMessage(event, userContent, quotePart, groupInfo)
  const agentBody = buildAgentBody(event, userMessage, buildDynamicCtx(processed))
  const body = `${event.senderName ?? event.senderId}: ${userContent}`

  // Stage 8: Dynamic Context
  const dynamicCtx = buildDynamicCtx(processed)

  return {
    event,
    isGroupChat,
    peerId,
    qualifiedTarget,
    fromAddress,
    parsedContent,
    userContent,
    quotePart,
    dynamicCtx,
    userMessage,
    agentBody,
    body,
    systemPrompts: accountConfig.systemPrompt ? [accountConfig.systemPrompt] : [],
    groupSystemPrompt: groupInfo?.display.behaviorPrompt,
    attachments: processed,
    localMediaPaths: [],
    localMediaTypes: [],
    remoteMediaUrls: processed.imageUrls,
    remoteMediaTypes: processed.imageMediaTypes,
    uniqueVoicePaths: [],
    uniqueVoiceUrls: processed.voiceAttachmentUrls,
    uniqueVoiceAsrReferTexts: processed.voiceAsrReferTexts,
    voiceMediaTypes: processed.voiceAttachmentUrls.map(() => "audio/wav"),
    hasAsrReferFallback: processed.voiceTranscriptSources.includes("asr"),
    voiceTranscriptSources: processed.voiceTranscriptSources,
    replyTo,
    commandAuthorized: access.reasonCode === "dm_policy_open" || access.reasonCode === "dm_policy_allowlisted",
    group: groupInfo,
    blocked: false,
    skipped: false,
    accessDecision: access.decision,
  }
}