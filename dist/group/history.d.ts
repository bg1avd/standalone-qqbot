/**
 * Group History Buffer — 群组消息历史缓冲
 *
 * 内存 Map 存储，key = groupOpenid，value = 历史条目数组。
 * 每个群组最多保留 historyLimit 条消息，超出时 FIFO 淘汰。
 *
 * 参考：OpenClaw QQBot 的 history.ts
 */
import type { QueuedMessage } from "../types/index.js";
export interface HistoryEntry {
    sender: string;
    body: string;
    timestamp: number;
    messageId: string;
    attachments?: Array<{
        type: "image" | "voice" | "video" | "file";
        filename?: string;
        transcript?: string;
    }>;
}
/**
 * 记录一条历史消息到指定群组的缓冲
 */
export declare function recordHistoryEntry(groupOpenid: string, entry: HistoryEntry, limit?: number): void;
/**
 * 获取群组的历史消息（最近的 limit 条）
 */
export declare function getHistoryEntries(groupOpenid: string, limit?: number): HistoryEntry[];
/**
 * 清除群组历史缓冲
 */
export declare function clearGroupHistory(groupOpenid: string): void;
/**
 * 清除所有历史缓冲
 */
export declare function clearAllHistory(): void;
/**
 * 从 QueuedMessage 构建 HistoryEntry
 */
export declare function buildHistoryEntry(msg: QueuedMessage, userContent: string, localPaths?: string[]): HistoryEntry;
//# sourceMappingURL=history.d.ts.map