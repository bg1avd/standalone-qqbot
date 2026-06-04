/**
 * Quote Resolver — 引用消息解析
 *
 * 根据 refMsgIdx 解析引用的消息内容：
 * 1. 优先从 RefIndex 缓存读取
 * 2. 回退：从 msg_elements[0] 直接解析
 * 3. 再回退：返回 id-only placeholder
 *
 * 参考：OpenClaw QQBot 的 quote-stage.ts
 */
import type { ReplyToInfo, QueuedMessage } from "../types/index.js";
/** 格式化引用条目为人类可读文本 */
export declare function formatRefEntryForAgent(entry: {
    content?: string;
    senderId?: string;
    senderName?: string;
    timestamp?: number;
    attachments?: Array<{
        type: string;
        filename?: string;
        transcript?: string;
    }>;
}): string;
/**
 * 解析引用消息
 *
 * @param event - 原始 QQ 事件
 * @returns ReplyToInfo 或 undefined（非引用消息）
 */
export declare function resolveQuote(event: Pick<QueuedMessage, "refMsgIdx" | "msgType" | "msgElements">): Promise<ReplyToInfo | undefined>;
//# sourceMappingURL=quote-resolver.d.ts.map