/**
 * Access Control — DM/Group 权限决策
 *
 * 实现 OpenClaw QQBot 的权限控制逻辑：
 * - dmPolicy: open | allowlist | disabled
 * - groupPolicy: open | allowlist | disabled
 * - allowFrom / groupAllowFrom 名单匹配（支持 "*" 通配符和 "qqbot:" 前缀）
 */
import { log } from "../utils/logger.js";
/** 标准化 sender ID：去除 "qqbot:" 前缀，转大写 */
function normalizeSenderId(senderId) {
    return senderId.replace(/^qqbot:/i, "").toUpperCase();
}
/** 标准化 allowFrom 列表 */
export function normalizeQQBotAllowFrom(raw) {
    return raw.map((id) => normalizeSenderId(id.trim()));
}
/** 创建 sender 匹配器（支持 "*" 通配符） */
export function createQQBotSenderMatcher(senderId) {
    const normalized = normalizeSenderId(senderId);
    return (allowFrom) => {
        if (allowFrom.includes("*"))
            return true;
        return allowFrom.some((allowed) => allowed === "*" || allowed === normalized);
    };
}
/**
 * 解析 QQBot 有效权限策略
 */
export function resolveQQBotEffectivePolicies(params) {
    const { allowFrom = [], groupAllowFrom = [], dmPolicy = "open", groupPolicy = "open" } = params;
    const normalizedAllowFrom = normalizeQQBotAllowFrom(allowFrom);
    const normalizedGroupAllowFrom = groupAllowFrom.length > 0
        ? normalizeQQBotAllowFrom(groupAllowFrom)
        : normalizedAllowFrom;
    return {
        effectiveAllowFrom: normalizedAllowFrom,
        effectiveGroupAllowFrom: normalizedGroupAllowFrom,
        dmPolicy,
        groupPolicy,
    };
}
/**
 * 执行访问控制决策
 */
export function resolveQQBotAccess(params) {
    const { isGroup, senderId } = params;
    const policies = resolveQQBotEffectivePolicies(params);
    const { effectiveAllowFrom, effectiveGroupAllowFrom, dmPolicy, groupPolicy } = policies;
    const allowList = isGroup ? effectiveGroupAllowFrom : effectiveAllowFrom;
    const policy = isGroup ? groupPolicy : dmPolicy;
    const matcher = createQQBotSenderMatcher(senderId);
    // disabled → 全部拒绝
    if (policy === "disabled") {
        const reasonCode = isGroup ? "group_policy_disabled" : "dm_policy_disabled";
        log.access.debug(`Access denied: ${reasonCode} (sender=${senderId})`);
        return {
            decision: "block",
            reasonCode,
            reason: isGroup ? "Group messages disabled" : "Direct messages disabled",
            effectiveAllowFrom,
            effectiveGroupAllowFrom,
            dmPolicy,
            groupPolicy,
        };
    }
    // open 策略
    if (policy === "open") {
        // allowFrom 包含 "*" → 全部允许
        if (allowList.includes("*")) {
            log.access.debug(`Access allowed: open policy with wildcard (sender=${senderId})`);
            return {
                decision: "allow",
                reasonCode: isGroup ? "group_policy_open" : "dm_policy_open",
                reason: "Open policy",
                effectiveAllowFrom,
                effectiveGroupAllowFrom,
                dmPolicy,
                groupPolicy,
            };
        }
        // 检查 sender 是否在 allowFrom 中
        if (matcher(allowList)) {
            const reasonCode = isGroup ? "group_policy_open" : "dm_policy_open";
            log.access.debug(`Access allowed: sender in allowFrom (sender=${senderId})`);
            return {
                decision: "allow",
                reasonCode,
                reason: "Sender in allowlist",
                effectiveAllowFrom,
                effectiveGroupAllowFrom,
                dmPolicy,
                groupPolicy,
            };
        }
        // open 策略但不在 allowFrom → 拒绝
        const reasonCode = isGroup ? "group_policy_not_allowlisted" : "dm_policy_not_allowlisted";
        log.access.info(`Access denied: ${reasonCode} (sender=${senderId})`);
        return {
            decision: "block",
            reasonCode,
            reason: isGroup ? "Sender not in group allowlist" : "Sender not in DM allowlist",
            effectiveAllowFrom,
            effectiveGroupAllowFrom,
            dmPolicy,
            groupPolicy,
        };
    }
    // allowlist 策略
    if (policy === "allowlist") {
        if (allowList.length === 0) {
            const reasonCode = isGroup ? "group_policy_empty_allowlist" : "dm_policy_empty_allowlist";
            log.access.warn(`Access denied: ${reasonCode} (empty allowlist)`);
            return {
                decision: "block",
                reasonCode,
                reason: isGroup ? "Group allowlist is empty" : "DM allowlist is empty",
                effectiveAllowFrom,
                effectiveGroupAllowFrom,
                dmPolicy,
                groupPolicy,
            };
        }
        if (matcher(allowList)) {
            const reasonCode = isGroup ? "group_policy_allowlisted" : "dm_policy_allowlisted";
            log.access.debug(`Access allowed: ${reasonCode} (sender=${senderId})`);
            return {
                decision: "allow",
                reasonCode,
                reason: "Sender in allowlist",
                effectiveAllowFrom,
                effectiveGroupAllowFrom,
                dmPolicy,
                groupPolicy,
            };
        }
        const reasonCode = isGroup ? "group_policy_not_allowlisted" : "dm_policy_not_allowlisted";
        log.access.info(`Access denied: ${reasonCode} (sender=${senderId})`);
        return {
            decision: "block",
            reasonCode,
            reason: isGroup ? "Sender not in group allowlist" : "Sender not in DM allowlist",
            effectiveAllowFrom,
            effectiveGroupAllowFrom,
            dmPolicy,
            groupPolicy,
        };
    }
    // 兜底：拒绝
    return {
        decision: "block",
        reasonCode: "unknown_policy",
        reason: "Unknown policy",
        effectiveAllowFrom,
        effectiveGroupAllowFrom,
        dmPolicy,
        groupPolicy,
    };
}
//# sourceMappingURL=access.js.map