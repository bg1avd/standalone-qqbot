/**
 * Zod schema definitions for QQBot configuration.
 * These schemas validate and infer the types defined in ../types/index.ts
 */
import { z } from "zod";
export declare const GroupConfigSchema: z.ZodObject<{
    requireMention: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    ignoreOtherMentions: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    toolPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["full", "restricted", "none"]>>>;
    name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    prompt: z.ZodOptional<z.ZodString>;
    historyLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    requireMention?: boolean;
    ignoreOtherMentions?: boolean;
    toolPolicy?: "full" | "restricted" | "none";
    name?: string;
    prompt?: string;
    historyLimit?: number;
}, {
    requireMention?: boolean;
    ignoreOtherMentions?: boolean;
    toolPolicy?: "full" | "restricted" | "none";
    name?: string;
    prompt?: string;
    historyLimit?: number;
}>;
export declare const QQBotAccountConfigSchema: z.ZodObject<{
    /** App ID — REQUIRED */
    appId: z.ZodString;
    /** Inline client secret — mutually exclusive with clientSecretFile */
    clientSecret: z.ZodOptional<z.ZodString>;
    /** Path to file containing the secret */
    clientSecretFile: z.ZodOptional<z.ZodString>;
    /** Direct message policy */
    dmPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["open", "allowlist", "disabled"]>>>;
    /** Group message policy */
    groupPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["open", "allowlist", "disabled"]>>>;
    /** Allowlist of sender IDs (supports "*" wildcard and "qqbot:" prefix) */
    allowFrom: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    /** Group allowlist (falls back to allowFrom if empty) */
    groupAllowFrom: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    /** Per-group overrides */
    groups: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        requireMention: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        ignoreOtherMentions: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        toolPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["full", "restricted", "none"]>>>;
        name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        prompt: z.ZodOptional<z.ZodString>;
        historyLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, "strip", z.ZodTypeAny, {
        requireMention?: boolean;
        ignoreOtherMentions?: boolean;
        toolPolicy?: "full" | "restricted" | "none";
        name?: string;
        prompt?: string;
        historyLimit?: number;
    }, {
        requireMention?: boolean;
        ignoreOtherMentions?: boolean;
        toolPolicy?: "full" | "restricted" | "none";
        name?: string;
        prompt?: string;
        historyLimit?: number;
    }>>>>;
    /** Custom system prompt */
    systemPrompt: z.ZodOptional<z.ZodString>;
    /** Audio format policy */
    audioFormatPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["silk", "wav", "auto"]>>>;
    /** Whether to upload outbound HTTP URLs directly without downloading */
    urlDirectUpload: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    appId?: string;
    clientSecret?: string;
    clientSecretFile?: string;
    dmPolicy?: "open" | "allowlist" | "disabled";
    groupPolicy?: "open" | "allowlist" | "disabled";
    allowFrom?: string[];
    groupAllowFrom?: string[];
    groups?: Record<string, {
        requireMention?: boolean;
        ignoreOtherMentions?: boolean;
        toolPolicy?: "full" | "restricted" | "none";
        name?: string;
        prompt?: string;
        historyLimit?: number;
    }>;
    systemPrompt?: string;
    audioFormatPolicy?: "silk" | "wav" | "auto";
    urlDirectUpload?: boolean;
}, {
    appId?: string;
    clientSecret?: string;
    clientSecretFile?: string;
    dmPolicy?: "open" | "allowlist" | "disabled";
    groupPolicy?: "open" | "allowlist" | "disabled";
    allowFrom?: string[];
    groupAllowFrom?: string[];
    groups?: Record<string, {
        requireMention?: boolean;
        ignoreOtherMentions?: boolean;
        toolPolicy?: "full" | "restricted" | "none";
        name?: string;
        prompt?: string;
        historyLimit?: number;
    }>;
    systemPrompt?: string;
    audioFormatPolicy?: "silk" | "wav" | "auto";
    urlDirectUpload?: boolean;
}>;
export declare const QQBotConfigSchema: z.ZodObject<{
    accounts: z.ZodArray<z.ZodObject<{
        /** App ID — REQUIRED */
        appId: z.ZodString;
        /** Inline client secret — mutually exclusive with clientSecretFile */
        clientSecret: z.ZodOptional<z.ZodString>;
        /** Path to file containing the secret */
        clientSecretFile: z.ZodOptional<z.ZodString>;
        /** Direct message policy */
        dmPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["open", "allowlist", "disabled"]>>>;
        /** Group message policy */
        groupPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["open", "allowlist", "disabled"]>>>;
        /** Allowlist of sender IDs (supports "*" wildcard and "qqbot:" prefix) */
        allowFrom: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        /** Group allowlist (falls back to allowFrom if empty) */
        groupAllowFrom: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
        /** Per-group overrides */
        groups: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
            requireMention: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            ignoreOtherMentions: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            toolPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["full", "restricted", "none"]>>>;
            name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
            prompt: z.ZodOptional<z.ZodString>;
            historyLimit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        }, "strip", z.ZodTypeAny, {
            requireMention?: boolean;
            ignoreOtherMentions?: boolean;
            toolPolicy?: "full" | "restricted" | "none";
            name?: string;
            prompt?: string;
            historyLimit?: number;
        }, {
            requireMention?: boolean;
            ignoreOtherMentions?: boolean;
            toolPolicy?: "full" | "restricted" | "none";
            name?: string;
            prompt?: string;
            historyLimit?: number;
        }>>>>;
        /** Custom system prompt */
        systemPrompt: z.ZodOptional<z.ZodString>;
        /** Audio format policy */
        audioFormatPolicy: z.ZodDefault<z.ZodOptional<z.ZodEnum<["silk", "wav", "auto"]>>>;
        /** Whether to upload outbound HTTP URLs directly without downloading */
        urlDirectUpload: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, "strip", z.ZodTypeAny, {
        appId?: string;
        clientSecret?: string;
        clientSecretFile?: string;
        dmPolicy?: "open" | "allowlist" | "disabled";
        groupPolicy?: "open" | "allowlist" | "disabled";
        allowFrom?: string[];
        groupAllowFrom?: string[];
        groups?: Record<string, {
            requireMention?: boolean;
            ignoreOtherMentions?: boolean;
            toolPolicy?: "full" | "restricted" | "none";
            name?: string;
            prompt?: string;
            historyLimit?: number;
        }>;
        systemPrompt?: string;
        audioFormatPolicy?: "silk" | "wav" | "auto";
        urlDirectUpload?: boolean;
    }, {
        appId?: string;
        clientSecret?: string;
        clientSecretFile?: string;
        dmPolicy?: "open" | "allowlist" | "disabled";
        groupPolicy?: "open" | "allowlist" | "disabled";
        allowFrom?: string[];
        groupAllowFrom?: string[];
        groups?: Record<string, {
            requireMention?: boolean;
            ignoreOtherMentions?: boolean;
            toolPolicy?: "full" | "restricted" | "none";
            name?: string;
            prompt?: string;
            historyLimit?: number;
        }>;
        systemPrompt?: string;
        audioFormatPolicy?: "silk" | "wav" | "auto";
        urlDirectUpload?: boolean;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    accounts?: {
        appId?: string;
        clientSecret?: string;
        clientSecretFile?: string;
        dmPolicy?: "open" | "allowlist" | "disabled";
        groupPolicy?: "open" | "allowlist" | "disabled";
        allowFrom?: string[];
        groupAllowFrom?: string[];
        groups?: Record<string, {
            requireMention?: boolean;
            ignoreOtherMentions?: boolean;
            toolPolicy?: "full" | "restricted" | "none";
            name?: string;
            prompt?: string;
            historyLimit?: number;
        }>;
        systemPrompt?: string;
        audioFormatPolicy?: "silk" | "wav" | "auto";
        urlDirectUpload?: boolean;
    }[];
}, {
    accounts?: {
        appId?: string;
        clientSecret?: string;
        clientSecretFile?: string;
        dmPolicy?: "open" | "allowlist" | "disabled";
        groupPolicy?: "open" | "allowlist" | "disabled";
        allowFrom?: string[];
        groupAllowFrom?: string[];
        groups?: Record<string, {
            requireMention?: boolean;
            ignoreOtherMentions?: boolean;
            toolPolicy?: "full" | "restricted" | "none";
            name?: string;
            prompt?: string;
            historyLimit?: number;
        }>;
        systemPrompt?: string;
        audioFormatPolicy?: "silk" | "wav" | "auto";
        urlDirectUpload?: boolean;
    }[];
}>;
//# sourceMappingURL=schema.d.ts.map