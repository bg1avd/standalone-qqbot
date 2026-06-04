/**
 * GatewayConnection — WebSocket lifecycle management.
 *
 * Handles:
 * - Token acquisition and refresh
 * - WebSocket connect / resume / reconnect
 * - Heartbeat
 * - Message dispatch
 * - Session persistence
 *
 * Reference: OpenClaw QQBot's gateway-connection.ts
 */
import type { QueuedMessage, ResolvedAccount } from "../types/index.js";
export interface GatewayEvents {
    onReady: (data: any) => void;
    onResumed: (data: any) => void;
    onInteraction: (event: any) => void;
    onMessage: (msg: QueuedMessage) => void;
    onDisconnect: (code: number, reason: string) => void;
    onError: (err: Error) => void;
}
export interface GatewayContext {
    account: ResolvedAccount;
    abortSignal: AbortSignal;
    handleMessage: (msg: QueuedMessage) => Promise<void>;
    getMessagePeerId: (msg: QueuedMessage) => string;
    events: GatewayEvents;
}
export declare class GatewayConnection {
    private ctx;
    private ws;
    private heartbeatInterval;
    private reconnectTimer;
    private reconnect;
    private shouldRefreshToken;
    private isAborted;
    private isConnecting;
    private sessionId;
    private lastSeq;
    private msgQueue;
    constructor(ctx: GatewayContext);
    /** Main entry point: start the connection loop. Resolves when abortSignal fires. */
    start(): Promise<void>;
    private sessionFilePath;
    private restoreSession;
    private saveCurrentSession;
    private clearSession;
    private registerAbortHandler;
    private cleanup;
    private connect;
    private handleHello;
    private dispatchEvent;
    private normalizeC2CMessage;
    private normalizeGroupMessage;
    private normalizeGuildMessage;
    private normalizeAttachments;
    private normalizeMentions;
    private scheduleReconnect;
    private handleClose;
    getQueueSnapshot(): import("./message-queue.js").QueueSnapshot;
}
//# sourceMappingURL=connection.d.ts.map