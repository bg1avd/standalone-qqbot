/**
 * Outbound Text Sender — 文本消息发送
 *
 * 调用 QQ 开放平台 REST API 发送文本消息。
 * 支持引用回复（msgId 参数）。
 *
 * API:
 * - C2C: POST /v2/users/{openid}/messages
 * - Group: POST /v2/groups/{group_openid}/messages
 * - Guild: POST /channels/{channel_id}/messages
 *
 * 参考：OpenClaw QQBot 的 sender-p-B14eLG.js
 */
import type { SendResult, SendTargetType } from "../types/index.js";
export interface SendTextOptions {
    /** 回复的消息 ID */
    msgId?: string;
    /** 是否使用 markdown 格式 */
    markdown?: boolean;
}
/**
 * 发送文本消息
 */
export declare function sendText(appId: string, accessToken: string, targetType: SendTargetType, targetId: string, content: string, options?: SendTextOptions): Promise<SendResult>;
//# sourceMappingURL=sender.d.ts.map