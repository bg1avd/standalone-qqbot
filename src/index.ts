/**
 * standalone-qqbot — 独立 QQ Bot SDK
 *
 * Usage:
 * ```typescript
 * import { QQBotClient } from 'standalone-qqbot'
 *
 * const client = new QQBotClient({ configPath: './qqbot.yaml' })
 *
 * client.on('message', async (ctx) => {
 *   console.log('Received:', ctx.userContent)
 *   await client.sendText('group', ctx.peerId, 'Hello!')
 * })
 *
 * await client.connect()
 * ```
 */

// Main client
export { QQBotClient } from "./adapter/client.js"

// Config
export { loadConfig, loadConfigWithDefaults, watchConfig, ConfigLoadError } from "./config/index.js"
export { QQBotConfigSchema, QQBotAccountConfigSchema, GroupConfigSchema } from "./config/index.js"
export type { QQBotConfig, QQBotAccountConfig, GroupConfig } from "./types/index.js"

// Gateway
export {
  GatewayConnection,
  getAccessToken,
  refreshAccessToken,
  startBackgroundTokenRefresh,
  stopBackgroundTokenRefresh,
  clearTokenCache,
  ReconnectState,
  GatewayCloseCode,
  createMessageQueue,
} from "./gateway/index.js"
export type { GatewayEvents, GatewayContext } from "./gateway/index.js"

// Inbound processing
export {
  resolveQQBotAccess,
  createQQBotSenderMatcher,
  normalizeQQBotAllowFrom,
  parseFaceTags,
  stripMentionText,
  replaceMentionsWithNicknames,
  parseUserContent,
  setRefIndex,
  getRefIndex,
  clearRefIndex,
  buildRefEntryFromMessage,
  resolveQuote,
  formatRefEntryForAgent,
  runAccessStage,
  processAttachments,
  buildUserContent,
  runGroupGateStage,
  buildQuotePart,
  buildUserMessage,
  buildAgentBody,
  buildDynamicCtx,
  buildInboundContext,
} from "./inbound/index.js"
export type {
  InboundContext,
  QueuedMessage,
  ProcessedAttachments,
  ReplyToInfo,
  GroupGateResult,
  AccessResult,
} from "./types/index.js"

// Group handling
export {
  recordHistoryEntry,
  getHistoryEntries,
  clearGroupHistory,
  clearAllHistory,
  buildHistoryEntry,
  shouldMergeMessages,
  mergeGroupMessages,
  detectWasMentioned,
  hasAnyMention,
  resolveImplicitMention,
} from "./group/index.js"
export type { HistoryEntry, MergedMessage } from "./group/index.js"

// Outbound sending
export { sendText, sendPhoto, sendVideo, sendDocument } from "./outbound/index.js"
export type { SendTextOptions, SendMediaOptions, SendResult, SendTargetType } from "./outbound/index.js"

// Commands
export {
  parseSlashCommand,
  isBuiltinCommand,
  isUrgentCommand,
  getBuiltinCommands,
  getHelpText,
  builtinCommands,
  findCommand,
  CommandRegistry,
  createCommandRegistry,
} from "./commands/index.js"
export type { ParsedCommand, SlashCommand } from "./commands/index.js"

// Types
export * from "./types/index.js"

// Logger
export { log, createLogger, setGlobalEnabled } from "./utils/logger.js"
export type { Logger } from "./utils/logger.js"

// Default export for convenience
export { QQBotClient as default } from "./adapter/client.js"