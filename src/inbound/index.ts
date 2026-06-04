/**
 * Inbound module — re-exports
 */

export { resolveQQBotAccess, createQQBotSenderMatcher, normalizeQQBotAllowFrom } from "./access.js"
export { parseFaceTags, stripMentionText, replaceMentionsWithNicknames, parseUserContent } from "./content-parser.js"
export { setRefIndex, getRefIndex, clearRefIndex, buildRefEntryFromMessage } from "./ref-index.js"
export { resolveQuote, formatRefEntryForAgent } from "./quote-resolver.js"
export {
  runAccessStage,
  processAttachments,
  buildUserContent,
  runGroupGateStage,
  buildQuotePart,
  buildUserMessage,
  buildAgentBody,
  buildDynamicCtx,
  buildInboundContext,
} from "./context-builder.js"