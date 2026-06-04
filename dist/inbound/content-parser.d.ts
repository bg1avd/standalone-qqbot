/**
 * Content Parser — QQ Emoji 标签和 Mention 标签解析
 *
 * - `<faceType=101 faceName=微笑>` → `[Emoji: 微笑]`
 * - `<@!openid>` → `@nickname` (群聊清理)
 * - `<@openid>` → `@nickname` (私聊替换)
 */
import type { Mention } from "../types/index.js";
/**
 * 解析 QQ Emoji 标签 → `[Emoji: name]`
 */
export declare function parseFaceTags(content: string): string;
/**
 * 清理群聊中的 mention 标签
 * - 机器人自己的 mention (`is_you=true`) → 直接移除
 * - 其他人的 mention → 替换为 `@nickname`
 */
export declare function stripMentionText(text: string, mentions: Mention[]): string;
/**
 * 私聊中替换 mention 标签为 nickname（尽力而为）
 */
export declare function replaceMentionsWithNicknames(text: string, mentions: Mention[]): string;
/**
 * 解析完整的用户可见内容
 * 1. Emoji 标签解析
 * 2. Mention 清理/替换
 */
export declare function parseUserContent(params: {
    content: string;
    type: "c2c" | "dm" | "group" | "guild";
    mentions?: Mention[];
}): string;
//# sourceMappingURL=content-parser.d.ts.map