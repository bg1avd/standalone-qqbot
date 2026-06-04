/**
 * Event Emitter — 轻量级事件发射器
 *
 * 基于 Node.js EventEmitter 的简化版本，
 * 支持类型安全的事件监听。
 */

import { EventEmitter } from "events"
import type { QQBotEvents, EventName } from "../types/index.js"
import { log } from "../utils/logger.js"

export class QQBotEventEmitter {
  private emitter = new EventEmitter()

  on<E extends EventName>(event: E, listener: QQBotEvents[E]): this {
    this.emitter.on(event, listener)
    log.gateway.debug?.(`Event listener registered: ${event}`)
    return this
  }

  off<E extends EventName>(event: E, listener: QQBotEvents[E]): this {
    this.emitter.off(event, listener)
    return this
  }

  emit<E extends EventName>(event: E, ...args: Parameters<QQBotEvents[E]>): boolean {
    log.gateway.debug?.(`Event emitted: ${event}`)
    return this.emitter.emit(event, ...args)
  }

  once<E extends EventName>(event: E, listener: QQBotEvents[E]): this {
    this.emitter.once(event, listener)
    return this
  }

  removeAllListeners<E extends EventName>(event?: E): this {
    if (event) {
      this.emitter.removeAllListeners(event)
    } else {
      this.emitter.removeAllListeners()
    }
    return this
  }

  listenerCount<E extends EventName>(event: E): number {
    return this.emitter.listenerCount(event)
  }
}