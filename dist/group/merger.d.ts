/**
 * Message Merger — 群组消息合并
 *
 * 将同个群组的多个排队消息合并为一个 AI turn，格式：
 * [Merged earlier messages — CONTEXT ONLY]
 * [用户 1]: 消息 1
 * [用户 2]: 消息 2
 * [CURRENT MESSAGE — reply using the context above]
 * [当前用户]: 当前消息 (@you)
 *
 * 参考：OpenClaw QQBot 的 merger.ts / history.ts
 */
import type { QueuedMessage } from "../types/index.js";
export interface MergedMessage {
    content: string;
    senderName?: string;
    senderId: string;
    type: QueuedMessage["type"];
    mentions?: QueuedMessage["mentions"];
    attachments?: QueuedMessage["attachments"];
}
/**
 * 检测消息是否应该被合并
 *
 * 合并条件：
 * - 同个群组 (groupOpenid 相同)
 * - 时间间隔 < 5 秒
 * - 队列中有多个消息
 */
export declare function shouldMergeMessages(messages: QueuedMessage[], groupOpenid: string, mergeWindowMs?: number): boolean;
/**
 * 合并多个群消息为一个 AI turn
 *
 * @param messages - 待合并的消息列表（按时间顺序）
 * @param atYouTag - 当前消息是否有 @you 标记
 * @returns 合并后的完整消息体
 */
export declare function mergeGroupMessages(messages: QueuedMessage[], atYouTag?: boolean): string;
//# sourceMappingURL=merger.d.ts.map