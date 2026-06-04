/**
 * Voice Sender — 语音消息发送
 *
 * 支持：
 * - WAV/PCM 格式自动编码为 SILK
 * - SILK 格式直接发送
 * - 大文件分块上传（>20MB）
 *
 * 依赖：silk-wasm (用户需 npm install silk-wasm)
 *
 * 参考：OpenClaw QQBot outbound logic
 */
import type { SendResult } from "../types/index.js";
/**
 * 检测音频格式
 */
export declare function detectAudioFormat(buffer: Uint8Array): "silk" | "wav" | "pcm" | "unknown";
/**
 * 编码为 SILK
 */
export declare function encodeToSilk(wavBuffer: Uint8Array): Promise<Uint8Array>;
/**
 * 发送语音消息
 *
 * @param ctx - 发送上下文（appId, accessToken, targetType, targetId）
 * @param audioPath - 本地音频文件路径（.wav, .pcm, .silk）
 * @param options - 可选配置（fileName, extraLocalRoots）
 */
export declare function sendVoice(ctx: {
    appId: string;
    accessToken: string;
    targetType: "c2c" | "group" | "channel" | "dm";
    targetId: string;
}, audioPath: string, options?: {
    fileName?: string;
    extraLocalRoots?: string[];
}): Promise<SendResult>;
//# sourceMappingURL=voice-sender.d.ts.map