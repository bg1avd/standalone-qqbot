/**
 * Per-peer message queue with concurrency control.
 *
 * - Each peer (c2c user / group / channel) has its own FIFO queue
 * - Global concurrency limit (default 10 peers processed simultaneously)
 * - Queue size limits: DM=20, Group=50
 * - When full: prefer dropping bot messages over human messages
 * - Group messages from the same group are merged into one AI turn
 */

import type { QueuedMessage } from "../types/index.js"
import { log } from "../utils/logger.js"

export interface MessageQueueOptions {
  maxConcurrentUsers?: number    // Global concurrent peers (default 10)
  peerQueueSize?: number         // DM/c2c queue size (default 20)
  groupQueueSize?: number         // Group queue size (default 50)
  globalQueueSoftLimit?: number   // Warn when global queue exceeds this (default 200)
}

const DEFAULT_OPTIONS: Required<MessageQueueOptions> = {
  maxConcurrentUsers: 10,
  peerQueueSize: 20,
  groupQueueSize: 50,
  globalQueueSoftLimit: 200,
}

function getMessagePeerId(msg: Pick<QueuedMessage, "type" | "senderId" | "groupOpenid" | "channelId" | "guildId">): string {
  if (msg.type === "group" && msg.groupOpenid) return `group:${msg.groupOpenid}`
  if (msg.type === "guild" && msg.channelId) return `channel:${msg.channelId}`
  if (msg.type === "dm" && msg.guildId) return `dm:${msg.guildId}`
  // c2c
  return `c2c:${msg.senderId}`
}

function isGroupPeer(peerId: string): boolean {
  return peerId.startsWith("group:")
}

function isMessageFromBot(msg: Pick<QueuedMessage, "senderIsBot">): boolean {
  return msg.senderIsBot === true
}

/** Evict one message from the queue (for queue overflow) */
function evictOne(queue: QueuedMessage[], isGroup: boolean): QueuedMessage | undefined {
  // In groups: prefer dropping bot messages (keep human messages)
  if (isGroup) {
    const botIdx = queue.findIndex((m) => isMessageFromBot(m))
    if (botIdx !== -1) return queue.splice(botIdx, 1)[0]
  }
  // Otherwise evict oldest
  return queue.shift()
}

export interface MessageQueue {
  enqueue: (msg: QueuedMessage) => void
  startProcessor: (handler: (msg: QueuedMessage) => Promise<void>) => void
  getSnapshot: (peerId?: string) => QueueSnapshot
  clearUserQueue: (peerId: string) => number
  executeImmediate: (msg: QueuedMessage) => void
  getMessagePeerId: (msg: Pick<QueuedMessage, "type" | "senderId" | "groupOpenid" | "channelId" | "guildId">) => string
}

export interface QueueSnapshot {
  totalPending: number
  activeUsers: number
  maxConcurrentUsers: number
  senderPending?: number
}

export function createMessageQueue(options: MessageQueueOptions = {}): MessageQueue {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const { maxConcurrentUsers, peerQueueSize, groupQueueSize, globalQueueSoftLimit } = opts

  /** Per-peer queues */
  const userQueues = new Map<string, QueuedMessage[]>()
  /** Currently active peers (being processed) */
  const activeUsers = new Set<string>()

  let totalEnqueued = 0
  let handleMessageFn: ((msg: QueuedMessage) => Promise<void>) | null = null

  function drainUserQueue(peerId: string): void {
    if (activeUsers.size >= maxConcurrentUsers) return
    if (!userQueues.has(peerId)) return
    if (activeUsers.has(peerId)) return

    const queue = userQueues.get(peerId)!
    if (queue.length === 0) {
      userQueues.delete(peerId)
      return
    }

    activeUsers.add(peerId)
    const msg = queue.shift()!
    totalEnqueued = Math.max(0, totalEnqueued - 1)

    if (handleMessageFn) {
      handleMessageFn(msg).finally(() => {
        activeUsers.delete(peerId)
        // Try to process next peer
        for (const [waitingPeerId, waitingQueue] of userQueues) {
          if (activeUsers.size >= maxConcurrentUsers) break
          if (waitingQueue.length > 0 && !activeUsers.has(waitingPeerId)) {
            drainUserQueue(waitingPeerId)
            break
          }
        }
      })
    }
  }

  const enqueue = (msg: QueuedMessage): void => {
    const peerId = getMessagePeerId(msg)
    const isGroup = isGroupPeer(peerId)

    let queue = userQueues.get(peerId)
    if (!queue) {
      queue = []
      userQueues.set(peerId, queue)
    }

    const maxSize = isGroup ? groupQueueSize : peerQueueSize

    if (queue.length >= maxSize) {
      const dropped = evictOne(queue, isGroup)
      totalEnqueued = Math.max(0, totalEnqueued - 1)

      if (isGroup && dropped && isMessageFromBot(dropped)) {
        log.gateway.info(`Queue full for ${peerId}, dropping bot message ${dropped.messageId}`)
      } else {
        log.gateway.error(`Queue full for ${peerId}, dropping message ${dropped?.messageId}`)
      }
    }

    totalEnqueued++
    if (totalEnqueued > globalQueueSoftLimit) {
      log.gateway.error(`Global queue limit reached (${totalEnqueued}), message from ${peerId} may be delayed`)
    }

    queue.push(msg)
    log.gateway.debug?.(`Message enqueued for ${peerId}, queue size: ${queue.length}, active users: ${activeUsers.size}`)

    drainUserQueue(peerId)
  }

  const startProcessor = (handler: (msg: QueuedMessage) => Promise<void>): void => {
    handleMessageFn = handler
    log.gateway.debug(`Message processor started (max ${maxConcurrentUsers} concurrent peers)`)
  }

  const getSnapshot = (peerId?: string): QueueSnapshot => {
    let totalPending = 0
    for (const [, q] of userQueues) totalPending += q.length
    const senderQueue = peerId ? userQueues.get(peerId) : undefined
    return {
      totalPending,
      activeUsers: activeUsers.size,
      maxConcurrentUsers,
      senderPending: senderQueue ? senderQueue.length : undefined,
    }
  }

  const clearUserQueue = (peerId: string): number => {
    const queue = userQueues.get(peerId)
    if (!queue || queue.length === 0) return 0
    const droppedCount = queue.length
    queue.length = 0
    totalEnqueued = Math.max(0, totalEnqueued - droppedCount)
    return droppedCount
  }

  const executeImmediate = (msg: QueuedMessage): void => {
    if (handleMessageFn) {
      handleMessageFn(msg).catch((err) => {
        log.gateway.error(`Immediate execution error: %s`, err instanceof Error ? err.message : String(err))
      })
    }
  }

  return {
    enqueue,
    startProcessor,
    getSnapshot,
    clearUserQueue,
    executeImmediate,
    getMessagePeerId,
  }
}