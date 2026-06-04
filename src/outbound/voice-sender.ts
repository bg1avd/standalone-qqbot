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

import { existsSync } from "fs"
import { readFile } from "fs/promises"
import { join } from "path"
import { log } from "../utils/logger.js"
import { ChunkedUploader, type ChunkedUploadContext } from "./chunked-upload.js"
import type { SendResult, MediaKind } from "../types/index.js"

const API_BASE = "https://api.q.qq.com"
const MAX_ONESHOT_SIZE = 20 * 1024 * 1024 // 20MB

// 动态加载 silk-wasm
let silkWasm: any = null

async function loadSilkWasm(): Promise<any> {
  if (silkWasm) return silkWasm

  try {
    const mod = await import("silk-wasm")
    silkWasm = mod
    return silkWasm
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to load silk-wasm. Install it: npm install silk-wasm. Details: ${msg}`)
  }
}

/**
 * 检测音频格式
 */
export function detectAudioFormat(buffer: Uint8Array): "silk" | "wav" | "pcm" | "unknown" {
  // 简单检测：silk 文件头通常是 0x02 0x00 或特定 ASCII
  // WAV 文件头是 "RIFF"
  if (buffer[0] === 0x02 && buffer[1] === 0x00) {
    return "silk"
  }

  if (buffer.length >= 4) {
    const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3])
    if (riff === "RIFF") {
      return "wav"
    }
  }

  // 假设其他情况为 PCM (raw)
  return "pcm"
}

/**
 * 编码为 SILK
 */
export async function encodeToSilk(wavBuffer: Uint8Array): Promise<Uint8Array> {
  const startTime = Date.now()
  const silk = await loadSilkWasm()

  try {
    const silkBuffer = silk.encode(wavBuffer)
    const duration = Date.now() - startTime
    log.voice.debug(`Encoded WAV ${wavBuffer.length} bytes → SILK ${silkBuffer.length} bytes in ${duration}ms`)
    return silkBuffer
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.voice.error(`SILK encode failed: ${msg}`)
    throw err
  }
}

/**
 * 发送语音消息
 *
 * @param ctx - 发送上下文（appId, accessToken, targetType, targetId）
 * @param audioPath - 本地音频文件路径（.wav, .pcm, .silk）
 * @param options - 可选配置（fileName, extraLocalRoots）
 */
export async function sendVoice(
  ctx: {
    appId: string
    accessToken: string
    targetType: "c2c" | "group" | "channel" | "dm"
    targetId: string
  },
  audioPath: string,
  options: { fileName?: string; extraLocalRoots?: string[] } = {}
): Promise<SendResult> {
  log.voice.info(`Sending voice: ${audioPath}`)

  // 1. 读取并检测格式
  if (!existsSync(audioPath)) {
    return { channel: "qqbot", error: `File not found: ${audioPath}` }
  }

  const fileData = await readFile(audioPath)
  const fileBuffer = new Uint8Array(fileData)
  const format = detectAudioFormat(fileBuffer)
  log.voice.debug(`Detected audio format: ${format}`)

  // 2. 如果需要编码，转换为 SILK
  let silkBuffer: Uint8Array
  if (format === "silk") {
    silkBuffer = fileBuffer
  } else {
    log.voice.info(`Encoding ${format} → SILK...`)
    silkBuffer = await encodeToSilk(fileBuffer)
  }

  // 3. 上传（小文件 one-shot，大文件分块）
  const fileName = options.fileName ?? join(audioPath).split("/").pop() ?? "voice.silk"
  const size = silkBuffer.byteLength

  if (size > MAX_ONESHOT_SIZE) {
    // 分块上传
    log.voice.info(`Large voice file (${size} bytes), using chunked upload`)
    try {
      const uploader = new ChunkedUploader()
      const result = await uploader.uploadFile(
        {
          appId: ctx.appId,
          accessToken: ctx.accessToken,
          targetType: ctx.targetType,
          targetId: ctx.targetId,
        },
        "voice",
        audioPath, // 直接传原文件路径让 uploader 读取（避免内存 double）
        fileName,
        {}
      )
      return await sendVoiceReference(ctx, "voice", result.fileUuid, fileName)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.voice.error(`Chunked upload failed: ${msg}`)
      return { channel: "qqbot", error: msg }
    }
  } else {
    // One-shot 上传：先将 silkBuffer 转为 data URL
    const base64 = Buffer.from(silkBuffer).toString("base64")
    const dataUrl = `data:audio/silk;base64,${base64}`

    // 复用 media-sender 的逻辑（但要发送 voice 类型）
    // 由于 media-sender 目前只支持 image/video/file，我们直接实现上传+引用
    return await sendVoiceFromDataUrl(ctx, dataUrl, fileName)
  }
}

/**
 * 通过 Data URL 发送语音（one-shot）
 */
async function sendVoiceFromDataUrl(
  ctx: { appId: string; accessToken: string; targetType: string; targetId: string },
  dataUrl: string,
  fileName: string
): Promise<SendResult> {
  try {
    // 解析 Base64
    const commaIdx = dataUrl.indexOf(",")
    const base64 = dataUrl.slice(commaIdx + 1)

    // 上传接口
    const apiPath = buildMediaUploadPath(ctx.targetType, "voice")
    const fullUrl = `${API_BASE}${apiPath}`.replace("{id}", ctx.targetId)

    const body: any = {
      file_type: 3, // voice type
      file_data: base64,
      filename: fileName,
    }

    const resp = await fetch(fullUrl, {
      method: "POST",
      headers: {
        Authorization: `QQBot ${ctx.accessToken}`,
        "X-Union-Appid": ctx.appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "")
      log.outbound.error(`Voice upload failed: HTTP ${resp.status}: ${errorText}`)
      return { channel: "qqbot", error: `HTTP ${resp.status}` }
    }

    const data = await resp.json() as { file_uuid?: string; file_info?: string }
    log.voice.info(`Voice uploaded: file_uuid=${data.file_uuid}`)

    // 发送引用
    return await sendVoiceReference(ctx, "voice", data.file_uuid, fileName)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.voice.error(`Voice upload failed: ${msg}`)
    return { channel: "qqbot", error: msg }
  }
}

/**
 * 发送语音引用（类似媒体引用）
 */
async function sendVoiceReference(
  ctx: { appId: string; accessToken: string; targetType: string; targetId: string },
  kind: MediaKind,
  fileUuid: string | undefined,
  fileName?: string
): Promise<SendResult> {
  if (!fileUuid) {
    return { channel: "qqbot", error: "Missing file_uuid for voice reference" }
  }

  try {
    const apiPath = buildMessageSendPath(ctx.targetType)
    const fullUrl = `${API_BASE}${apiPath}`.replace("{id}", ctx.targetId)

    const body: any = {
      content: "",
      msg_type: 2, // 假设语音消息类型是 2 (需确认 QQ API)
      media: {
        file_uuid: fileUuid,
        filename: fileName ?? "voice.silk",
      },
    }

    const resp = await fetch(fullUrl, {
      method: "POST",
      headers: {
        Authorization: `QQBot ${ctx.accessToken}`,
        "X-Union-Appid": ctx.appId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "")
      log.voice.error(`Voice reference send failed: HTTP ${resp.status}: ${errorText}`)
      return { channel: "qqbot", error: `HTTP ${resp.status}` }
    }

    const data = await resp.json() as { id: string }
    log.voice.info(`Voice reference sent: message_id=${data.id}`)

    return { channel: "qqbot", messageId: data.id }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.voice.error(`Voice reference send failed: ${msg}`)
    return { channel: "qqbot", error: msg }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function buildMediaUploadPath(targetType: string, kind: "voice"): string {
  const resource = getTargetResource(targetType)
  return `/v2/${resource}/{id}/files`
}

function buildMessageSendPath(targetType: string): string {
  switch (targetType) {
    case "c2c":
      return `/v2/users/{id}/messages`
    case "group":
      return `/v2/groups/{id}/messages`
    case "channel":
      return `/channels/{id}/messages`
    case "dm":
      return `/dms/{id}/messages`
    default:
      return `/v2/groups/{id}/messages`
  }
}

function getTargetResource(targetType: string): string {
  switch (targetType) {
    case "c2c":
    case "dm":
      return "users"
    case "group":
      return "groups"
    case "channel":
    case "guild":
      return "channels"
    default:
      return "groups"
  }
}
