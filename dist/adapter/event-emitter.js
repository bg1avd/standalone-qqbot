/**
 * Event Emitter — 轻量级事件发射器
 *
 * 基于 Node.js EventEmitter 的简化版本，
 * 支持类型安全的事件监听。
 */
import { EventEmitter } from "events";
import { log } from "../utils/logger.js";
export class QQBotEventEmitter {
    emitter = new EventEmitter();
    on(event, listener) {
        this.emitter.on(event, listener);
        log.gateway.debug?.(`Event listener registered: ${event}`);
        return this;
    }
    off(event, listener) {
        this.emitter.off(event, listener);
        return this;
    }
    emit(event, ...args) {
        log.gateway.debug?.(`Event emitted: ${event}`);
        return this.emitter.emit(event, ...args);
    }
    once(event, listener) {
        this.emitter.once(event, listener);
        return this;
    }
    removeAllListeners(event) {
        if (event) {
            this.emitter.removeAllListeners(event);
        }
        else {
            this.emitter.removeAllListeners();
        }
        return this;
    }
    listenerCount(event) {
        return this.emitter.listenerCount(event);
    }
}
//# sourceMappingURL=event-emitter.js.map