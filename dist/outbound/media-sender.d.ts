/**
 * Media Sender — 图片/视频/文件发送
 *
 * 支持：
 * - 本地文件路径
 * - HTTP/HTTPS URL
 * - Base64 Data URL（小文件）
 *
 * 大文件分块上传（P2 实现），小文件 one-shot 上传。
 *
 * 参考：OpenClaw QQBot 的 outbound-BJfhwrPg.js
 */
import type { SendResult, SendTargetType } from "../types/index.js";
export interface SendMediaOptions {
    /** 回复的消息 ID */
    msgId?: string;
    /** 文件名（可选，默认从 path 解析） */
    fileName?: string;
    /** 允许额外本地路径根目录 */
    extraLocalRoots?: string[];
}
interface MediaContext {
    appId: string;
    accessToken: string;
    targetType: SendTargetType;
    targetId: string;
    msgId?: string;
}
/**
 * 发送图片
 */
export declare function sendPhoto(ctx: MediaContext, imagePath: string, options?: SendMediaOptions): Promise<SendResult>;
/**
 * 发送视频
 */
export declare function sendVideo(ctx: MediaContext, videoPath: string, options?: SendMediaOptions): Promise<SendResult>;
/**
 * 发送文件
 */
export declare function sendDocument(ctx: MediaContext, filePath: string, options?: SendMediaOptions): Promise<SendResult>;
/**
 * 发送语音消息（Phase 3.1）
 */
export declare function sendVoice(ctx: MediaContext, audioPath: string, options?: SendMediaOptions): Promise<SendResult>;
export {};
//# sourceMappingURL=media-sender.d.ts.map