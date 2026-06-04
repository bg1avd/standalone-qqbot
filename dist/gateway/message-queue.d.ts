/**
 * Per-peer message queue with concurrency control.
 *
 * - Each peer (c2c user / group / channel) has its own FIFO queue
 * - Global concurrency limit (default 10 peers processed simultaneously)
 * - Queue size limits: DM=20, Group=50
 * - When full: prefer dropping bot messages over human messages
 * - Group messages from the same group are merged into one AI turn
 */
import type { QueuedMessage } from "../types/index.js";
export interface MessageQueueOptions {
    maxConcurrentUsers?: number;
    peerQueueSize?: number;
    groupQueueSize?: number;
    globalQueueSoftLimit?: number;
}
export interface MessageQueue {
    enqueue: (msg: QueuedMessage) => void;
    startProcessor: (handler: (msg: QueuedMessage) => Promise<void>) => void;
    getSnapshot: (peerId?: string) => QueueSnapshot;
    clearUserQueue: (peerId: string) => number;
    executeImmediate: (msg: QueuedMessage) => void;
    getMessagePeerId: (msg: Pick<QueuedMessage, "type" | "senderId" | "groupOpenid" | "channelId" | "guildId">) => string;
}
export interface QueueSnapshot {
    totalPending: number;
    activeUsers: number;
    maxConcurrentUsers: number;
    senderPending?: number;
}
export declare function createMessageQueue(options?: MessageQueueOptions): MessageQueue;
//# sourceMappingURL=message-queue.d.ts.map