/**
 * Core type definitions for standalone-qqbot
 */

// ============================================================================
// Config Types
// ============================================================================

export interface GroupConfig {
  requireMention?: boolean
  ignoreOtherMentions?: boolean
  toolPolicy?: "full" | "restricted" | "none"
  name?: string
  prompt?: string
  historyLimit?: number
}

export interface QQBotAccountConfig {
  /** App ID from QQ Open Platform */
  appId: string
  /** App Secret */
  clientSecret: string
  /** Path to file containing the secret (alternative to inline) */
  clientSecretFile?: string
  /** Direct message policy */
  dmPolicy?: "open" | "allowlist" | "disabled"
  /** Group message policy */
  groupPolicy?: "open" | "allowlist" | "disabled"
  /** Allowlist of sender IDs for DMs (supports "*" wildcard and "qqbot:" prefix) */
  allowFrom?: string[]
  /** Allowlist of sender IDs for groups (falls back to allowFrom if empty) */
  groupAllowFrom?: string[]
  /** Per-group configuration overrides */
  groups?: Record<string, GroupConfig>
  /** Custom system prompt for this account */
  systemPrompt?: string
  /** Audio format policy */
  audioFormatPolicy?: "silk" | "wav" | "auto"
  /** URL direct upload (skip download for outbound HTTP URLs) */
  urlDirectUpload?: boolean
}

export interface QQBotConfig {
  accounts: QQBotAccountConfig[]
}

export interface ResolvedAccount {
  appId: string
  clientSecret: string
  config: QQBotAccountConfig
  accountId: string
}

// ============================================================================
// Event Types (from QQ WebSocket Gateway)
// ============================================================================

export type QQEventType = "c2c" | "dm" | "group" | "guild"

export type QQGatewayEventType =
  | "READY"
  | "RESUMED"
  | "C2C_MESSAGE_CREATE"
  | "AT_MESSAGE_CREATE"
  | "DIRECT_MESSAGE_CREATE"
  | "GROUP_AT_MESSAGE_CREATE"
  | "GROUP_MESSAGE_CREATE"
  | "INTERACTION_CREATE"

export interface Attachment {
  url: string
  filename?: string
  content_type?: string
  voice_wav_url?: string
  asr_refer_text?: string
}

export interface Mention {
  member_openid?: string
  id?: string
  user_openid?: string
  username?: string
  nickname?: string
  is_you?: boolean
}

export interface QueuedMessage {
  type: QQEventType
  senderId: string
  senderName?: string
  senderIsBot?: boolean
  content: string
  messageId: string
  timestamp: number
  groupOpenid?: string
  channelId?: string
  guildId?: string
  attachments?: Attachment[]
  refMsgIdx?: string
  msgIdx?: string
  msgType?: number
  msgElements?: any[]
  eventType?: string
  mentions?: Mention[]
  messageScene?: any
  merge?: {
    count: number
    messages: QueuedMessage[]
  }
}

// ============================================================================
// Inbound Context
// ============================================================================

export interface ProcessedAttachments {
  attachmentInfo: string
  imageUrls: string[]
  imageMediaTypes: string[]
  voiceAttachmentPaths: string[]
  voiceAttachmentUrls: string[]
  voiceAsrReferTexts: string[]
  voiceTranscripts: string[]
  voiceTranscriptSources: string[]
  voiceDecodedWavPaths: string[] // Phase 2.3: 解码后的 WAV 文件路径
  attachmentLocalPaths: string[]
}

export interface ReplyToInfo {
  id: string
  body?: string
  sender?: string
  isQuote: boolean
}

export interface GroupDisplay {
  groupName: string
  senderLabel: string
  introHint?: string
  behaviorPrompt?: string
}

export interface GroupGateResult {
  gate: {
    action: "pass" | "skip_no_mention" | "drop_other_mention" | "block_unauthorized_command"
    effectiveWasMentioned: boolean
    shouldBypassMention: boolean
  }
  activation: "mention" | "always" | "never"
  historyLimit: number
  isMerged: boolean
  mergedMessages?: QueuedMessage[]
  display: GroupDisplay
}

export interface InboundContext {
  event: QueuedMessage
  isGroupChat: boolean
  peerId: string
  qualifiedTarget: string
  fromAddress: string
  parsedContent: string
  userContent: string
  quotePart: string
  dynamicCtx: string
  userMessage: string
  agentBody: string
  body: string
  systemPrompts: string[]
  groupSystemPrompt?: string
  attachments: ProcessedAttachments
  localMediaPaths: string[]
  localMediaTypes: string[]
  remoteMediaUrls: string[]
  remoteMediaTypes: string[]
  uniqueVoicePaths: string[]
  uniqueVoiceUrls: string[]
  uniqueVoiceAsrReferTexts: string[]
  voiceMediaTypes: string[]
  hasAsrReferFallback: boolean
  voiceTranscriptSources: string[]
  replyTo?: ReplyToInfo
  commandAuthorized: boolean
  group?: GroupGateResult
  blocked: boolean
  skipped: boolean
  accessDecision: "allow" | "block"
  skipReason?: string
  blockReason?: string
}

// ============================================================================
// Outbound Types
// ============================================================================

export type SendTargetType = "c2c" | "group" | "channel" | "dm"

export interface SendResult {
  channel: "qqbot"
  messageId?: string
  timestamp?: number
  error?: string
  errorCode?: string
}

export type MediaKind = "image" | "voice" | "video" | "file"

export interface MediaUploadResult {
  channel: "qqbot"
  fileUuid?: string
  fileInfo?: string
  error?: string
}

// ============================================================================
// Access Control
// ============================================================================

export interface AccessResult {
  decision: "allow" | "block"
  reasonCode: string
  reason: string
  effectiveAllowFrom: string[]
  effectiveGroupAllowFrom: string[]
  dmPolicy: "open" | "allowlist" | "disabled"
  groupPolicy: "open" | "allowlist" | "disabled"
}

// ============================================================================
// Slash Commands
// ============================================================================

export interface CommandContext {
  type: QQEventType
  senderId: string
  senderName?: string
  messageId: string
  eventTimestamp: number
  receivedAt: number
  rawContent: string
  args: string
  channelId?: string
  groupOpenid?: string
  accountId: string
  appId: string
  commandAuthorized: boolean
}

export type CommandHandler = (ctx: CommandContext) => Promise<string | { text: string; filePath?: string } | null>

export interface SlashCommand {
  name: string
  description: string
  requireAuth?: boolean
  handler: CommandHandler
}

// ============================================================================
// API Types
// ============================================================================

export interface ApiCredentials {
  appId: string
  accessToken: string
}

// ============================================================================
// Client Options
// ============================================================================

export interface QQBotClientOptions {
  configPath?: string
  config?: QQBotConfig
  dataDir?: string
  debug?: boolean
  onConfigReload?: (config: QQBotConfig) => void
  webConfig?: WebConfigServerOptions // Phase 3.2
}

// ============================================================================
// Web Config UI Types (Phase 3.2)
// ============================================================================

export interface WebConfigServerOptions {
  port?: number
  host?: string
  configDir: string
  username?: string
  password?: string
  allowedOrigins?: string[]
}

// ============================================================================
// Event Emitter Types
// ============================================================================

export interface QQBotEvents {
  "raw:message": (event: string, data: any) => void
  message: (ctx: InboundContext, account: ResolvedAccount) => void
  interaction: (data: any, account: ResolvedAccount) => void
  ready: (data: any, account: ResolvedAccount) => void
  resumed: (data: any, account: ResolvedAccount) => void
  disconnect: (code: number, reason: string, account: ResolvedAccount) => void
  reconnecting: (attempt: number, account: ResolvedAccount) => void
  error: (err: Error, account: ResolvedAccount) => void
  "access:denied": (ctx: InboundContext, reason: string, account: ResolvedAccount) => void
  "group:skip": (ctx: InboundContext, reason: string, account: ResolvedAccount) => void
}

export type EventName = keyof QQBotEvents