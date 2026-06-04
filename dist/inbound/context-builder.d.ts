/**
 * Context Builder — 8-stage 入站上下文构建流水线
 *
 * Stages:
 * 1. runAccessStage() — 权限检查
 * 2. processAttachments() — 附件下载（P2 语音暂缓）
 * 3. buildUserContent() — Emoji/Mention解析
 * 4. resolveQuote() — 引用解析
 * 5. writeRefIndex() — 引用缓存写入
 * 6. runGroupGateStage() — 群组门控（仅 group）
 * 7. buildBody/UserMessage/AgentBody — AI 输入渲染
 * 8. buildDynamicCtx() — 元信息附加
 *
 * 参考：OpenClaw QQBot 的 inbound-pipeline.ts
 */
import type { InboundContext, QueuedMessage, ProcessedAttachments, ReplyToInfo, GroupGateResult, AccessResult, QQBotAccountConfig } from "../types/index.js";
export declare function runAccessStage(event: QueuedMessage, accountConfig: QQBotAccountConfig): {
    kind: "block";
    context: Partial<InboundContext>;
} | {
    kind: "allow";
    access: AccessResult;
    isGroupChat: boolean;
    peerId: string;
    qualifiedTarget: string;
    fromAddress: string;
};
export declare function processAttachments(attachments: QueuedMessage["attachments"], options?: {
    downloadImages?: boolean;
    dataDir?: string;
    enableVoiceProcessing?: boolean;
    sttApiKey?: string;
}): Promise<ProcessedAttachments>;
export declare function buildUserContent(event: QueuedMessage, processed: ProcessedAttachments): {
    parsedContent: string;
    userContent: string;
};
export interface GroupGateInput {
    event: QueuedMessage;
    userContent: string;
    accountConfig: QQBotAccountConfig;
    agentId?: string;
    sessionStoreReader?: (key: string) => any;
}
export declare function runGroupGateStage(input: GroupGateInput): {
    kind: "pass";
    groupInfo: GroupGateResult;
} | {
    kind: "skip";
    groupInfo: GroupGateResult;
    skipReason: string;
} | null;
export declare function buildQuotePart(replyTo?: ReplyToInfo): string;
export declare function buildUserMessage(event: QueuedMessage, userContent: string, quotePart: string, groupInfo?: GroupGateResult): string;
export declare function buildAgentBody(event: QueuedMessage, userMessage: string, dynamicCtx: string): string;
export declare function buildDynamicCtx(processed: ProcessedAttachments): string;
export declare function buildInboundContext(event: QueuedMessage, accountConfig: QQBotAccountConfig): Promise<InboundContext>;
//# sourceMappingURL=context-builder.d.ts.map