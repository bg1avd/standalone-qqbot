/**
 * Group History Buffer — 群组消息历史缓冲
 *
 * 内存 Map 存储，key = groupOpenid，value = 历史条目数组。
 * 每个群组最多保留 historyLimit 条消息，超出时 FIFO 淘汰。
 *
 * 参考：OpenClaw QQBot 的 history.ts
 */
import { log } from "../utils/logger.js";
/** 全局历史缓冲 Map */
const historyMap = new Map();
/**
 * 记录一条历史消息到指定群组的缓冲
 */
export function recordHistoryEntry(groupOpenid, entry, limit = 50) {
    let buffer = historyMap.get(groupOpenid);
    if (!buffer) {
        buffer = { entries: [], limit };
        historyMap.set(groupOpenid, buffer);
    }
    buffer.entries.push(entry);
    // FIFO 淘汰
    while (buffer.entries.length > buffer.limit) {
        buffer.entries.shift();
    }
    log.group.debug?.(`History recorded for ${groupOpenid}: ${buffer.entries.length}/${buffer.limit}`);
}
/**
 * 获取群组的历史消息（最近的 limit 条）
 */
export function getHistoryEntries(groupOpenid, limit) {
    const buffer = historyMap.get(groupOpenid);
    if (!buffer)
        return [];
    const effectiveLimit = limit ?? buffer.limit;
    return buffer.entries.slice(-effectiveLimit);
}
/**
 * 清除群组历史缓冲
 */
export function clearGroupHistory(groupOpenid) {
    historyMap.delete(groupOpenid);
    log.group.debug?.(`History cleared for ${groupOpenid}`);
}
/**
 * 清除所有历史缓冲
 */
export function clearAllHistory() {
    historyMap.clear();
    log.group.debug?.(`All history cleared`);
}
/**
 * 从 QueuedMessage 构建 HistoryEntry
 */
export function buildHistoryEntry(msg, userContent, localPaths) {
    return {
        sender: msg.senderName ? `${msg.senderName} (${msg.senderId})` : msg.senderId,
        body: userContent,
        timestamp: msg.timestamp,
        messageId: msg.messageId,
        attachments: msg.attachments?.map((att, i) => ({
            type: inferAttachmentType(att.content_type),
            filename: att.filename,
            transcript: att.asr_refer_text,
            localPath: localPaths?.[i],
        })),
    };
}
function inferAttachmentType(contentType) {
    const ct = (contentType ?? "").toLowerCase();
    if (ct.startsWith("image/"))
        return "image";
    if (ct === "voice" || ct.startsWith("audio/") || ct.includes("silk") || ct.includes("amr"))
        return "voice";
    if (ct.startsWith("video/"))
        return "video";
    return "file";
}
//# sourceMappingURL=history.js.map