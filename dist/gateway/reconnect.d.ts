/**
 * Reconnection state machine for WebSocket Gateway.
 *
 * Handles QQ's specific close codes and computes exponential backoff delays.
 */
export declare const GatewayCloseCode: {
    readonly NORMAL: 1000;
    readonly ABNORMAL: 1006;
    readonly INSUFFICIENT_INTENTS: 4914;
    readonly DISALLOWED_INTENTS: 4915;
    readonly AUTH_FAILED: 4004;
    readonly RATE_LIMITED: 4008;
    readonly INVALID_SESSION: 4006;
    readonly SEQ_OUT_OF_RANGE: 4007;
    readonly SESSION_TIMEOUT: 4009;
    readonly SERVER_ERROR_START: 5000;
    readonly SERVER_ERROR_END: 5999;
};
export interface CloseAction {
    shouldReconnect: boolean;
    reconnectDelay?: number;
    clearSession: boolean;
    refreshToken: boolean;
    fatal: boolean;
    reason: string;
}
export declare class ReconnectState {
    private accountId;
    private attempts;
    private lastConnectTime;
    private quickDisconnectCount;
    constructor(accountId: string);
    /** Call when WebSocket successfully connects */
    onConnected(): void;
    isExhausted(): boolean;
    getNextDelay(customDelay?: number): number;
    handleClose(code: number, isAborted: boolean): CloseAction;
}
//# sourceMappingURL=reconnect.d.ts.map