/**
 * Outbound module — re-exports
 */

export { sendText } from "./sender.js"
export type { SendTextOptions } from "./sender.js"

export { sendPhoto, sendVideo, sendDocument } from "./media-sender.js"
export type { SendMediaOptions } from "./media-sender.js"

// Re-export types from types
export type { SendResult, SendTargetType } from "../types/index.js"