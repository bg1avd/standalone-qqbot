/**
 * Reference Index — 引用消息缓存
 *
 * 缓存最近的消息（TTL 300s），供后续引用解析使用。
 * 内存 Map 存储，key = msgIdx，value = RefEntry。
 *
 * 参考：OpenClaw QQBot 的 refidx-stage.ts
 */
import { log } from "../utils/logger.js";
const SESSION_EXPIRE_TIME = 300_000; // 300s TTL
/** 全局引用缓存 */
const refIndexStore = new Map();
/** 定时清理过期条目（每 60s） */
let cleanupInterval = null;
function ensureCleanupStarted() {
    if (cleanupInterval)
        return;
    cleanupInterval = setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, entry] of refIndexStore.entries()) {
            if (entry.expiresAt < now) {
                refIndexStore.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            log.inbound.debug?.(`Cleaned ${cleaned} expired refIndex entries`);
        }
    }, 60_000);
    // Node.js 退出时自动清理
    cleanupInterval.unref?.();
}
/**
 * 写入引用缓存
 */
export function setRefIndex(msgIdx, entry) {
    ensureCleanupStarted();
    const now = Date.now();
    refIndexStore.set(msgIdx, {
        content: entry.content,
        senderId: entry.senderId,
        senderName: entry.senderName,
        timestamp: entry.timestamp ?? now,
        attachments: entry.attachments,
        expiresAt: now + SESSION_EXPIRE_TIME,
    });
    log.inbound.debug?.(`RefIndex cached: msgIdx=${msgIdx} sender=${entry.senderId}`);
}
/**
 * 从缓存读取引用条目
 */
export function getRefIndex(msgIdx) {
    const entry = refIndexStore.get(msgIdx);
    if (!entry)
        return undefined;
    // 检查是否过期
    if (entry.expiresAt < Date.now()) {
        refIndexStore.delete(msgIdx);
        return undefined;
    }
    return {
        content: entry.content,
        senderId: entry.senderId,
        senderName: entry.senderName,
        timestamp: entry.timestamp,
        attachments: entry.attachments,
    };
}
/**
 * 清除所有缓存（退出时调用）
 */
export function clearRefIndex() {
    refIndexStore.clear();
    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }
}
/**
 * 从 QueuedMessage 构建 RefEntry
 */
export function buildRefEntryFromMessage(msg) {
    return {
        content: msg.content,
        senderId: msg.senderId,
        senderName: msg.senderName,
        attachments: msg.attachments?.map((att) => ({
            type: inferAttachmentType(att.content_type),
            url: att.url,
            filename: att.filename,
            transcript: att.asr_refer_text,
            transcriptSource: att.asr_refer_text ? "asr" : undefined,
        })),
    };
}
/** 从 content_type 推断附件类型 */
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
//# sourceMappingURL=ref-index.js.map