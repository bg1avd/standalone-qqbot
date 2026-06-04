/**
 * Voice Processor — 语音消息处理
 *
 * 功能：
 * - 解码 SILK 音频为 WAV/PCM 格式
 * - STT 语音转文字（可选，需要外部 API）
 *
 * 依赖：silk-wasm (WebAssembly SILK 解码器)
 *
 * 注意：此为可选功能，默认不启用。需要在配置中设置 features.voice = true
 *
 * 参考：OpenClaw QQBot 的 voice handling logic
 */
export interface VoiceProcessorOptions {
    /** 启用 STT 语音转文字 */
    enableSTT?: boolean;
    /** STT API 配置（可选） */
    sttApiKey?: string;
    /** STT 服务端点（可选） */
    sttEndpoint?: string;
    /** 音频输出格式 */
    outputFormat?: "wav" | "pcm";
}
export interface ProcessedVoice {
    /** 原始下载的 .silk buffer */
    silkBuffer: Uint8Array;
    /** 解码后的 WAV buffer */
    wavBuffer?: Uint8Array;
    /** STT 识别的文字（如果启用） */
    transcript?: string;
    /** 处理耗时 (ms) */
    duration?: number;
}
/**
 * 解码 SILK 音频为 WAV
 */
export declare function decodeSILK(silkBuffer: Uint8Array, options?: VoiceProcessorOptions): Promise<Uint8Array>;
/**
 * 可选：STT 语音转文字
 * 目前支持 OpenAI Whisper API（用户需自备 API Key）
 */
export declare function transcribeAudio(wavBuffer: Uint8Array, options?: VoiceProcessorOptions): Promise<string>;
/**
 * 完整语音处理流程：下载 → 解码 → 转文字（可选）
 */
export declare function processVoice(silkBuffer: Uint8Array, options?: VoiceProcessorOptions): Promise<ProcessedVoice>;
/**
 * 便捷函数：从 URL 下载并处理语音
 */
export declare function downloadAndProcessVoice(url: string, options?: VoiceProcessorOptions): Promise<ProcessedVoice>;
//# sourceMappingURL=voice-processor.d.ts.map