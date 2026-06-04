/**
 * Mention Detector — 群组 @检测
 *
 * 检测消息是否 @了机器人：
 * 1. mentions[].is_you === true（最可靠）
 * 2. eventType === "GROUP_AT_MESSAGE_CREATE"（QQ 平台级事件）
 * 3. mentionPatterns 正则匹配（ fallback，如 "@bot-name"）
 *
 * 参考：OpenClaw QQBot 的 mention.ts
 */
import type { QueuedMessage } from "../types/index.js";
export interface MentionDetectionInput {
    mentions?: QueuedMessage["mentions"];
    eventType?: QueuedMessage["eventType"];
    content: string;
    mentionPatterns?: string[];
}
/**
 * 检测消息是否 @了机器人
 */
export declare function detectWasMentioned(input: MentionDetectionInput): boolean;
/**
 * 检测是否有任何 @mention（不一定是 @机器人）
 */
export declare function hasAnyMention(input: Pick<MentionDetectionInput, "mentions" | "content">): boolean;
/**
 * 检测隐式 @（引用了机器人的消息）
 *
 * 当用户引用了机器人之前的消息时，视为隐式 @。
 * 需要查询 RefIndex 来判断被引用的消息是否是机器人发送的。
 */
export declare function resolveImplicitMention(params: {
    refMsgIdx?: string;
    getRefEntry: (msgIdx: string) => {
        isBot?: boolean;
    } | undefined;
}): boolean;
//# sourceMappingURL=mention-detector.d.ts.map