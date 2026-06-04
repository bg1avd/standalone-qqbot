/**
 * Group module — re-exports
 */
export { recordHistoryEntry, getHistoryEntries, clearGroupHistory, clearAllHistory, buildHistoryEntry } from "./history.js";
export type { HistoryEntry } from "./history.js";
export { shouldMergeMessages, mergeGroupMessages } from "./merger.js";
export type { MergedMessage } from "./merger.js";
export { detectWasMentioned, hasAnyMention, resolveImplicitMention } from "./mention-detector.js";
//# sourceMappingURL=index.d.ts.map