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
import { log } from "../utils/logger.js";
// 动态导入 silk-wasm（按需加载，避免必须依赖）
let silkWasm = null;
/**
 * 懒加载 silk-wasm 模块
 */
async function loadSilkWasm() {
    if (silkWasm)
        return silkWasm;
    try {
        // 尝试动态导入 silk-wasm（用户需 npm install silk-wasm）
        const mod = await import("silk-wasm");
        silkWasm = mod;
        return silkWasm;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to load silk-wasm. Please install it: npm install silk-wasm. Details: ${msg}`);
    }
}
/**
 * 解码 SILK 音频为 WAV
 */
export async function decodeSILK(silkBuffer, options = {}) {
    const startTime = Date.now();
    try {
        const silk = await loadSilkWasm();
        // 调用解码器
        const wavBuffer = await silk.decode(new Uint8Array(silkBuffer));
        const duration = Date.now() - startTime;
        log.voice.debug(`Decoded SILK ${silkBuffer.length} bytes → WAV ${wavBuffer.byteLength} bytes in ${duration}ms`);
        return wavBuffer;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.voice.error(`SILK decode failed: ${msg}`);
        throw err;
    }
}
/**
 * 可选：STT 语音转文字
 * 目前支持 OpenAI Whisper API（用户需自备 API Key）
 */
export async function transcribeAudio(wavBuffer, options = {}) {
    if (!options.enableSTT) {
        return "";
    }
    if (!options.sttApiKey) {
        log.voice.warn("STT enabled but no API key provided. Skipping transcription.");
        return "";
    }
    const startTime = Date.now();
    try {
        // 使用 OpenAI Whisper API
        const endpoint = options.sttEndpoint ?? "https://api.openai.com/v1/audio/transcriptions";
        const formData = new FormData();
        formData.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
        formData.append("model", "whisper-1");
        formData.append("language", "zh"); // 默认中文，可配置
        const resp = await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${options.sttApiKey}`,
            },
            body: formData,
        });
        if (!resp.ok) {
            const error = await resp.text().catch(() => "Unknown error");
            throw new Error(`STT API failed: HTTP ${resp.status} - ${error}`);
        }
        const data = await resp.json();
        const duration = Date.now() - startTime;
        log.voice.info(`Transcribed audio in ${duration}ms: ${data.text.slice(0, 50)}...`);
        return data.text;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.voice.error(`Transcription failed: ${msg}`);
        return ""; // 失败时返回空，不阻塞流程
    }
}
/**
 * 完整语音处理流程：下载 → 解码 → 转文字（可选）
 */
export async function processVoice(silkBuffer, options = {}) {
    const result = {
        silkBuffer,
    };
    try {
        // Step 1: 解码
        const wavBuffer = await decodeSILK(silkBuffer, options);
        result.wavBuffer = wavBuffer;
        // Step 2: 转文字（可选）
        if (options.enableSTT) {
            const transcript = await transcribeAudio(wavBuffer, options);
            result.transcript = transcript;
        }
        result.duration = Date.now() - (result.duration ?? 0);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.voice.error(`Voice processing failed: ${msg}`);
        // 即使解码失败，也返回 silkBuffer，让下游决定如何处理
    }
    return result;
}
/**
 * 便捷函数：从 URL 下载并处理语音
 */
export async function downloadAndProcessVoice(url, options = {}) {
    try {
        log.voice.info(`Downloading voice from: ${url}`);
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
        }
        const buffer = await resp.arrayBuffer();
        const silkBuffer = new Uint8Array(buffer);
        return await processVoice(silkBuffer, options);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.voice.error(`Download voice failed: ${msg}`);
        throw err;
    }
}
//# sourceMappingURL=voice-processor.js.map