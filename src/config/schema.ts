/**
 * Zod schema definitions for QQBot configuration.
 * These schemas validate and infer the types defined in ../types/index.ts
 */

import { z } from "zod"

// ============================================================================
// Sub-schemas
// ============================================================================

export const GroupConfigSchema = z.object({
  requireMention: z.boolean().optional().default(true),
  ignoreOtherMentions: z.boolean().optional().default(false),
  toolPolicy: z.enum(["full", "restricted", "none"]).optional().default("restricted"),
  name: z.string().optional().default(""),
  prompt: z.string().optional(),
  historyLimit: z.number().int().nonnegative().optional().default(50),
})

export const QQBotAccountConfigSchema = z.object({
  /** App ID — REQUIRED */
  appId: z.string().min(1, "appId is required"),
  /** Inline client secret — mutually exclusive with clientSecretFile */
  clientSecret: z.string().optional(),
  /** Path to file containing the secret */
  clientSecretFile: z.string().optional(),
  /** Direct message policy */
  dmPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),
  /** Group message policy */
  groupPolicy: z.enum(["open", "allowlist", "disabled"]).optional().default("open"),
  /** Allowlist of sender IDs (supports "*" wildcard and "qqbot:" prefix) */
  allowFrom: z.array(z.string()).optional().default([]),
  /** Group allowlist (falls back to allowFrom if empty) */
  groupAllowFrom: z.array(z.string()).optional().default([]),
  /** Per-group overrides */
  groups: z.record(GroupConfigSchema).optional().default({}),
  /** Custom system prompt */
  systemPrompt: z.string().optional(),
  /** Audio format policy */
  audioFormatPolicy: z.enum(["silk", "wav", "auto"]).optional().default("auto"),
  /** Whether to upload outbound HTTP URLs directly without downloading */
  urlDirectUpload: z.boolean().optional().default(true),
})

export const QQBotConfigSchema = z.object({
  accounts: z.array(QQBotAccountConfigSchema).min(1, "At least one account is required"),
})