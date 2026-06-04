/**
 * Access Control — DM/Group 权限决策
 *
 * 实现 OpenClaw QQBot 的权限控制逻辑：
 * - dmPolicy: open | allowlist | disabled
 * - groupPolicy: open | allowlist | disabled
 * - allowFrom / groupAllowFrom 名单匹配（支持 "*" 通配符和 "qqbot:" 前缀）
 */
import type { AccessResult } from "../types/index.js";
/** 标准化 allowFrom 列表 */
export declare function normalizeQQBotAllowFrom(raw: string[]): string[];
/** 创建 sender 匹配器（支持 "*" 通配符） */
export declare function createQQBotSenderMatcher(senderId: string): (allowFrom: string[]) => boolean;
/**
 * 解析 QQBot 有效权限策略
 */
export declare function resolveQQBotEffectivePolicies(params: {
    allowFrom?: string[];
    groupAllowFrom?: string[];
    dmPolicy?: "open" | "allowlist" | "disabled";
    groupPolicy?: "open" | "allowlist" | "disabled";
}): {
    effectiveAllowFrom: string[];
    effectiveGroupAllowFrom: string[];
    dmPolicy: "open" | "allowlist" | "disabled";
    groupPolicy: "open" | "allowlist" | "disabled";
};
/**
 * 执行访问控制决策
 */
export declare function resolveQQBotAccess(params: {
    isGroup: boolean;
    senderId: string;
    allowFrom?: string[];
    groupAllowFrom?: string[];
    dmPolicy?: "open" | "allowlist" | "disabled";
    groupPolicy?: "open" | "allowlist" | "disabled";
}): AccessResult;
//# sourceMappingURL=access.d.ts.map