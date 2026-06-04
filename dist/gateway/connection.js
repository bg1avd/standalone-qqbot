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
import WebSocket from "ws";
import { log } from "../utils/logger.js";
import { getAccessToken, startBackgroundTokenRefresh, stopBackgroundTokenRefresh, clearTokenCache } from "./token.js";
import { ReconnectState } from "./reconnect.js";
import { createMessageQueue } from "./message-queue.js";
// QQ Gateway opcodes
const GatewayOp = {
    DISPATCH: 0,
    HELLO: 10,
    IDENTIFY: 2,
    RESUME: 6,
    HEARTBEAT: 1,
    HEARTBEAT_ACK: 11,
    RECONNECT: 7,
    INVALID_SESSION: 9,
};
// Full intents (all events we need)
const FULL_INTENTS = (1 << 30) | // PUBLIC_GUILD_MESSAGES — 频道消息
    (1 << 25) | // GROUP_AND_C2C — 群聊消息
    (1 << 29) | // GUILD_MESSAGES — 频道消息(含 AT)
    (1 << 0) | // GUILDS — 频道事件
    (1 << 1) | // GUILD_MEMBERS — 频道成员
    (1 << 26) | // INTERACTION — 按钮交互
    4096; // DIRECT_MESSAGE — 私信
const GATEWAY_URL = "https://api.q.qq.com";
function getPluginUserAgent() {
    return `QQBotSDK/1.0 (standalone-qqbot; Node.js ${process.version})`;
}
async function getGatewayUrl(accessToken, appId) {
    const url = `${GATEWAY_URL}/gateway`;
    const resp = await fetch(url, {
        headers: {
            Authorization: `QQBot ${accessToken}`,
            "X-Union-Appid": appId,
            "User-Agent": getPluginUserAgent(),
        },
    });
    if (!resp.ok) {
        throw new Error(`Failed to get gateway URL: HTTP ${resp.status}`);
    }
    const data = await resp.json();
    if (!data.url)
        throw new Error("QQ API returned no gateway URL");
    // Add ?encoding=json if not present
    return data.url.includes("?") ? data.url : `${data.url}?encoding=json`;
}
function decodeGatewayMessageData(data) {
    if (Buffer.isBuffer(data))
        return new TextDecoder().decode(data);
    if (data instanceof ArrayBuffer)
        return new TextDecoder().decode(data);
    if (ArrayBuffer.isView(data))
        return new TextDecoder().decode(data.buffer);
    return String(data);
}
export class GatewayConnection {
    ctx;
    ws = null;
    heartbeatInterval = null;
    reconnectTimer = null;
    reconnect;
    shouldRefreshToken = false;
    isAborted = false;
    isConnecting = false;
    sessionId = null;
    lastSeq = null;
    msgQueue;
    constructor(ctx) {
        this.ctx = ctx;
        this.reconnect = new ReconnectState(ctx.account.accountId);
        this.msgQueue = createMessageQueue();
    }
    /** Main entry point: start the connection loop. Resolves when abortSignal fires. */
    async start() {
        this.restoreSession();
        this.registerAbortHandler();
        await this.connect();
        // Block until aborted
        return new Promise((resolve) => {
            this.ctx.abortSignal.addEventListener("abort", () => resolve());
        });
    }
    // -------------------------------------------------------------------------
    // Session persistence
    // -------------------------------------------------------------------------
    sessionFilePath() {
        const dataDir = process.env.QQBOT_DATA_DIR ?? `${process.env.HOME}/.standalone-qqbot`;
        return `${dataDir}/sessions/session-${Buffer.from(this.ctx.account.accountId).toString("base64")}.json`;
    }
    restoreSession() {
        try {
            const { readFileSync, existsSync } = require("fs");
            const path = this.sessionFilePath();
            if (!existsSync(path))
                return;
            const raw = JSON.parse(readFileSync(path, "utf-8"));
            this.sessionId = raw.sessionId ?? null;
            this.lastSeq = raw.lastSeq ?? null;
            if (this.sessionId) {
                log.gateway.debug(`Restored session: sessionId=%s lastSeq=%s`, this.sessionId, this.lastSeq);
            }
        }
        catch {
            // Ignore errors — session will be created fresh
        }
    }
    saveCurrentSession() {
        try {
            const { mkdirSync, writeFileSync, existsSync } = require("fs");
            const path = this.sessionFilePath();
            mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
            writeFileSync(path, JSON.stringify({
                sessionId: this.sessionId,
                lastSeq: this.lastSeq,
                lastConnectedAt: Date.now(),
                accountId: this.ctx.account.accountId,
                appId: this.ctx.account.appId,
                savedAt: Date.now(),
            }));
        }
        catch {
            // Ignore
        }
    }
    clearSession() {
        try {
            const { unlinkSync, existsSync } = require("fs");
            const path = this.sessionFilePath();
            if (existsSync(path))
                unlinkSync(path);
        }
        catch {
            // Ignore
        }
        this.sessionId = null;
        this.lastSeq = null;
    }
    // -------------------------------------------------------------------------
    // Abort handling
    // -------------------------------------------------------------------------
    registerAbortHandler() {
        this.ctx.abortSignal.addEventListener("abort", () => {
            this.isAborted = true;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            this.cleanup();
            stopBackgroundTokenRefresh(this.ctx.account.appId);
        });
    }
    cleanup() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            this.ws.close();
        }
        this.ws = null;
    }
    // -------------------------------------------------------------------------
    // Connection
    // -------------------------------------------------------------------------
    async connect() {
        if (this.isConnecting) {
            log.gateway.debug(`Already connecting, skip`);
            return;
        }
        this.isConnecting = true;
        try {
            this.cleanup();
            if (this.shouldRefreshToken) {
                log.gateway.debug(`Refreshing token...`);
                clearTokenCache(this.ctx.account.appId);
                this.shouldRefreshToken = false;
            }
            const accessToken = await getAccessToken(this.ctx.account.appId, this.ctx.account.clientSecret);
            log.gateway.info(`Access token obtained`);
            const gatewayUrl = await getGatewayUrl(accessToken, this.ctx.account.appId);
            log.gateway.info(`Connecting to %s`, gatewayUrl);
            const ws = new WebSocket(gatewayUrl, {
                headers: { "User-Agent": getPluginUserAgent() },
            });
            this.ws = ws;
            // Message handler that tries slash command first, then enqueues
            const trySlashOrEnqueue = async (msg) => {
                // Slash command check — for now, just enqueue everything
                // TODO: implement slash command matching (Phase 1.6)
                this.msgQueue.enqueue(msg);
            };
            ws.on("open", () => {
                log.gateway.info(`WebSocket connected`);
                this.isConnecting = false;
                this.reconnect.onConnected();
                this.msgQueue.startProcessor(this.ctx.handleMessage);
                startBackgroundTokenRefresh(this.ctx.account.appId, this.ctx.account.clientSecret);
            });
            ws.on("message", async (raw) => {
                try {
                    const data = decodeGatewayMessageData(raw);
                    const parsed = JSON.parse(data);
                    const { op, d, s, t } = parsed;
                    if (s) {
                        this.lastSeq = s;
                        this.saveCurrentSession();
                    }
                    switch (op) {
                        case GatewayOp.HELLO:
                            this.handleHello(ws, d, accessToken);
                            break;
                        case GatewayOp.DISPATCH: {
                            log.gateway.debug(`Dispatch event: t=%s`, t);
                            const result = this.dispatchEvent(t ?? "", d);
                            if (result.kind === "ready") {
                                this.sessionId = result.sessionId ?? null;
                                this.saveCurrentSession();
                                this.ctx.events.onReady?.(result.data);
                            }
                            else if (result.kind === "resumed") {
                                this.saveCurrentSession();
                                this.ctx.events.onResumed?.(result.data);
                            }
                            else if (result.kind === "interaction") {
                                this.ctx.events.onInteraction?.(result.event);
                            }
                            else if (result.kind === "message") {
                                await trySlashOrEnqueue(result.msg);
                            }
                            break;
                        }
                        case GatewayOp.HEARTBEAT_ACK:
                            // Heartbeat acknowledged — normal
                            break;
                        case GatewayOp.RECONNECT:
                            log.gateway.info(`Server requested reconnect`);
                            this.cleanup();
                            this.scheduleReconnect();
                            break;
                        case GatewayOp.INVALID_SESSION:
                            if (!d) {
                                this.sessionId = null;
                                this.lastSeq = null;
                                this.clearSession();
                                this.shouldRefreshToken = true;
                            }
                            this.cleanup();
                            this.scheduleReconnect(3000);
                            break;
                        default:
                            log.gateway.debug?.(`Unknown opcode: op=%d`, op);
                    }
                }
                catch (err) {
                    log.gateway.error(`Message parse error: %s`, err instanceof Error ? err.message : String(err));
                }
            });
            ws.on("close", (code, reason) => {
                log.gateway.info(`WebSocket closed: code=%d reason=%s`, code, reason.toString());
                this.isConnecting = false;
                this.handleClose(code);
            });
            ws.on("error", (err) => {
                log.gateway.error(`WebSocket error: %s`, err.message);
                this.ctx.events.onError?.(err);
            });
        }
        catch (err) {
            this.isConnecting = false;
            const msg = err instanceof Error ? err.message : String(err);
            log.gateway.error(`Connection failed: %s`, msg);
            if (msg.includes("Too many requests") || msg.includes("100001")) {
                this.scheduleReconnect(60_000);
            }
            else {
                this.scheduleReconnect();
            }
        }
    }
    // -------------------------------------------------------------------------
    // Hello / Identify / Resume
    // -------------------------------------------------------------------------
    handleHello(ws, d, accessToken) {
        // If we have a previous session, try to resume
        if (this.sessionId && this.lastSeq !== null) {
            ws.send(JSON.stringify({
                op: GatewayOp.RESUME,
                d: {
                    token: `QQBot ${accessToken}`,
                    session_id: this.sessionId,
                    seq: this.lastSeq,
                },
            }));
            log.gateway.debug(`Sent RESUME (sessionId=%s seq=%s)`, this.sessionId, this.lastSeq);
        }
        else {
            ws.send(JSON.stringify({
                op: GatewayOp.IDENTIFY,
                d: {
                    token: `QQBot ${accessToken}`,
                    intents: FULL_INTENTS,
                    shard: [0, 1],
                },
            }));
            log.gateway.debug(`Sent IDENTIFY`);
        }
        // Start heartbeat
        const interval = d.heartbeat_interval;
        if (this.heartbeatInterval)
            clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: GatewayOp.HEARTBEAT, d: this.lastSeq }));
            }
        }, interval);
    }
    // -------------------------------------------------------------------------
    // Event dispatch
    // -------------------------------------------------------------------------
    dispatchEvent(t, d) {
        switch (t) {
            case "READY":
                return { kind: "ready", data: d, sessionId: d.session_id ?? null };
            case "RESUMED":
                return { kind: "resumed", data: d };
            case "C2C_MESSAGE_CREATE":
                return { kind: "message", msg: this.normalizeC2CMessage(d) };
            case "AT_MESSAGE_CREATE":
                return { kind: "message", msg: this.normalizeGuildMessage(d, "guild") };
            case "DIRECT_MESSAGE_CREATE":
                return { kind: "message", msg: this.normalizeGuildMessage(d, "dm") };
            case "GROUP_AT_MESSAGE_CREATE":
                return { kind: "message", msg: this.normalizeGroupMessage(d, "GROUP_AT_MESSAGE_CREATE") };
            case "GROUP_MESSAGE_CREATE":
                return { kind: "message", msg: this.normalizeGroupMessage(d, "GROUP_MESSAGE_CREATE") };
            case "INTERACTION_CREATE":
                return { kind: "interaction", event: d };
            default:
                log.gateway.debug?.(`Ignoring event type: %s`, t);
                return { kind: "ignore" };
        }
    }
    normalizeC2CMessage(d) {
        return {
            type: "c2c",
            senderId: d.author?.id ?? d.sender?.id ?? "",
            senderName: d.author?.username ?? d.sender?.nickname ?? "",
            senderIsBot: d.author?.bot ?? d.sender?.bot ?? false,
            content: d.content ?? "",
            messageId: d.id ?? d.message_id ?? "",
            timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
            attachments: this.normalizeAttachments(d.attachments),
            refMsgIdx: d.src_guild_id ? String(d.message_reference?.message_id ?? "") : String(d.msg_id ?? ""),
            msgIdx: String(d.msg_id ?? ""),
            msgType: d.msg_type,
            msgElements: d.msg_elements,
            eventType: "C2C_MESSAGE_CREATE",
            mentions: this.normalizeMentions(d.mentions),
        };
    }
    normalizeGroupMessage(d, eventType) {
        return {
            type: "group",
            senderId: d.author?.id ?? d.sender?.id ?? "",
            senderName: d.author?.nickname ?? d.sender?.nickname ?? "",
            senderIsBot: d.author?.bot ?? d.sender?.bot ?? false,
            content: d.content ?? "",
            messageId: d.id ?? d.message_id ?? "",
            timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
            groupOpenid: d.group_openid ?? "",
            attachments: this.normalizeAttachments(d.attachments),
            refMsgIdx: String(d.message_id ?? ""),
            msgIdx: String(d.msg_idx ?? ""),
            msgType: d.msg_type,
            msgElements: d.msg_elements,
            eventType,
            mentions: this.normalizeMentions(d.mentions),
        };
    }
    normalizeGuildMessage(d, type) {
        return {
            type,
            senderId: d.author?.id ?? d.sender?.id ?? "",
            senderName: d.author?.username ?? d.sender?.nickname ?? "",
            senderIsBot: d.author?.bot ?? d.sender?.bot ?? false,
            content: d.content ?? "",
            messageId: d.id ?? d.message_id ?? "",
            timestamp: d.timestamp ? new Date(d.timestamp).getTime() : Date.now(),
            channelId: d.channel_id ?? "",
            guildId: d.guild_id ?? d.src_guild_id ?? "",
            attachments: this.normalizeAttachments(d.attachments),
            refMsgIdx: String(d.message_id ?? ""),
            msgIdx: String(d.msg_idx ?? ""),
            msgType: d.msg_type,
            msgElements: d.msg_elements,
            eventType: type === "guild" ? "AT_MESSAGE_CREATE" : "DIRECT_MESSAGE_CREATE",
            mentions: this.normalizeMentions(d.mentions),
        };
    }
    normalizeAttachments(atts) {
        if (!Array.isArray(atts))
            return [];
        return atts.map((a) => ({
            url: a.url ?? "",
            filename: a.filename,
            content_type: a.content_type,
            voice_wav_url: a.voice_wav_url,
            asr_refer_text: a.asr_refer_text,
        }));
    }
    normalizeMentions(mentions) {
        if (!Array.isArray(mentions))
            return [];
        return mentions.map((m) => ({
            member_openid: m.member_openid,
            id: m.id,
            user_openid: m.user_openid,
            username: m.username,
            nickname: m.nickname,
            is_you: m.is_you,
        }));
    }
    // -------------------------------------------------------------------------
    // Reconnect
    // -------------------------------------------------------------------------
    scheduleReconnect(customDelay) {
        if (this.isAborted || this.reconnect.isExhausted()) {
            log.gateway.error(`Max reconnect attempts reached or aborted — giving up`);
            return;
        }
        const delay = this.reconnect.getNextDelay(customDelay);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.isAborted)
                this.connect();
        }, delay);
    }
    handleClose(code) {
        const action = this.reconnect.handleClose(code, this.isAborted);
        if (action.clearSession) {
            this.sessionId = null;
            this.lastSeq = null;
            this.clearSession();
        }
        if (action.refreshToken)
            this.shouldRefreshToken = true;
        this.cleanup();
        if (action.fatal)
            return;
        if (action.shouldReconnect)
            this.scheduleReconnect(action.reconnectDelay);
        this.ctx.events.onDisconnect?.(code, action.reason);
    }
    // -------------------------------------------------------------------------
    // Public helpers
    // -------------------------------------------------------------------------
    getQueueSnapshot() {
        return this.msgQueue.getSnapshot();
    }
}
//# sourceMappingURL=connection.js.map