/**
 * Reference Index — 引用消息缓存
 *
 * 缓存最近的消息（TTL 300s），供后续引用解析使用。
 * 内存 Map 存储，key = msgIdx，value = RefEntry。
 *
 * 参考：OpenClaw QQBot 的 refidx-stage.ts
 */
import type { QueuedMessage } from "../types/index.js";
export interface RefEntry {
    content: string;
    senderId: string;
    senderName?: string;
    timestamp: number;
    attachments?: Array<{
        type: "image" | "voice" | "video" | "file";
        url?: string;
        filename?: string;
        transcript?: string;
        transcriptSource?: "stt" | "asr" | "fallback";
    }>;
}
/**
 * 写入引用缓存
 */
export declare function setRefIndex(msgIdx: string, entry: Omit<RefEntry, "timestamp"> & {
    timestamp?: number;
}): void;
/**
 * 从缓存读取引用条目
 */
export declare function getRefIndex(msgIdx: string): RefEntry | undefined;
/**
 * 清除所有缓存（退出时调用）
 */
export declare function clearRefIndex(): void;
/**
 * 从 QueuedMessage 构建 RefEntry
 */
export declare function buildRefEntryFromMessage(msg: QueuedMessage): Omit<RefEntry, "timestamp"> & {
    timestamp?: number;
};
//# sourceMappingURL=ref-index.d.ts.map