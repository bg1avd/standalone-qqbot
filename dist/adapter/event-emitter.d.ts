/**
 * Event Emitter — 轻量级事件发射器
 *
 * 基于 Node.js EventEmitter 的简化版本，
 * 支持类型安全的事件监听。
 */
import type { QQBotEvents, EventName } from "../types/index.js";
export declare class QQBotEventEmitter {
    private emitter;
    on<E extends EventName>(event: E, listener: QQBotEvents[E]): this;
    off<E extends EventName>(event: E, listener: QQBotEvents[E]): this;
    emit<E extends EventName>(event: E, ...args: Parameters<QQBotEvents[E]>): boolean;
    once<E extends EventName>(event: E, listener: QQBotEvents[E]): this;
    removeAllListeners<E extends EventName>(event?: E): this;
    listenerCount<E extends EventName>(event: E): number;
}
//# sourceMappingURL=event-emitter.d.ts.map