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
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { log } from "../utils/logger.js";
const API_BASE = "https://api.q.qq.com";
const MAX_ONESHOT_SIZE = 20 * 1024 * 1024; // 20MB for one-shot upload
/**
 * 发送图片
 */
export async function sendPhoto(ctx, imagePath, options = {}) {
    log.outbound.debug(`Sending photo: ${imagePath.slice(0, 80)}`);
    return sendMedia(ctx, "image", imagePath, options);
}
/**
 * 发送视频
 */
export async function sendVideo(ctx, videoPath, options = {}) {
    log.outbound.debug(`Sending video: ${videoPath.slice(0, 80)}`);
    return sendMedia(ctx, "video", videoPath, options);
}
/**
 * 发送文件
 */
export async function sendDocument(ctx, filePath, options = {}) {
    log.outbound.debug(`Sending document: ${filePath.slice(0, 80)}`);
    return sendMedia(ctx, "file", filePath, options);
}
/**
 * 通用媒体发送入口
 */
async function sendMedia(ctx, kind, mediaPath, options = {}) {
    // 解析路径类型
    const isHttp = mediaPath.startsWith("http://") || mediaPath.startsWith("https://");
    const isData = mediaPath.startsWith("data:");
    const isLocal = !isHttp && !isData;
    if (isLocal) {
        // 本地文件：验证路径安全
        const resolvedPath = resolveLocalPath(mediaPath, options.extraLocalRoots);
        if (!resolvedPath.ok) {
            return { channel: "qqbot", error: resolvedPath.error };
        }
        // 检查文件存在和大小
        if (!existsSync(resolvedPath.path)) {
            return { channel: "qqbot", error: `File not found: ${resolvedPath.path}` };
        }
        const size = getFileSize(resolvedPath.path);
        if (size > MAX_ONESHOT_SIZE) {
            // TODO: implement chunked upload (P2)
            return { channel: "qqbot", error: `File too large (${formatFileSize(size)}). Chunked upload not yet implemented.` };
        }
        const fileName = options.fileName ?? basename(resolvedPath.path);
        return sendMediaFromLocal(ctx, kind, resolvedPath.path, fileName);
    }
    if (isHttp) {
        // HTTP URL：直接上传（QQ 支持 URL 直传）
        const fileName = options.fileName ?? basename(new URL(mediaPath).pathname);
        return sendMediaFromUrl(ctx, kind, mediaPath, fileName);
    }
    if (isData) {
        // Base64 Data URL
        return sendMediaFromBase64(ctx, kind, mediaPath, options.fileName);
    }
    return { channel: "qqbot", error: `Unsupported media source: ${mediaPath.slice(0, 50)}` };
}
/**
 * 发送本地文件
 */
async function sendMediaFromLocal(ctx, kind, localPath, fileName) {
    try {
        const fileData = readFileSync(localPath);
        const base64 = fileData.toString("base64");
        const dataUrl = `data:${getMimeType(kind, fileName)};base64,${base64}`;
        return sendMediaFromBase64(ctx, kind, dataUrl, fileName);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.outbound.error(`Failed to read local file: ${msg}`);
        return { channel: "qqbot", error: `Failed to read file: ${msg}` };
    }
}
/**
 * 发送 URL 文件
 */
async function sendMediaFromUrl(ctx, kind, url, fileName) {
    try {
        const apiPath = buildMediaUploadPath(ctx.targetType, kind);
        const fullUrl = `${API_BASE}${apiPath}`.replace("{id}", ctx.targetId);
        const body = {
            file_type: getMediaType(kind),
            url,
            filename: fileName,
        };
        if (ctx.msgId) {
            body.msg_id = ctx.msgId;
        }
        const resp = await fetch(fullUrl, {
            method: "POST",
            headers: {
                Authorization: `QQBot ${ctx.accessToken}`,
                "X-Union-Appid": ctx.appId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const errorText = await resp.text().catch(() => "");
            log.outbound.error(`URL upload failed: HTTP ${resp.status}`);
            return { channel: "qqbot", error: `HTTP ${resp.status}` };
        }
        const data = await resp.json();
        log.outbound.info(`URL media uploaded: file_uuid=${data.file_uuid}`);
        // Media 上传完成后需要再调用消息 API 发送引用
        return sendMediaReference(ctx, kind, data.file_uuid, fileName);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.outbound.error(`URL upload failed: ${msg}`);
        return { channel: "qqbot", error: msg };
    }
}
/**
 * 发送 Base64 数据
 */
async function sendMediaFromBase64(ctx, kind, dataUrl, fileName) {
    try {
        // 解析 Base64
        const commaIdx = dataUrl.indexOf(",");
        const base64 = dataUrl.slice(commaIdx + 1);
        const apiPath = buildMediaUploadPath(ctx.targetType, kind);
        const fullUrl = `${API_BASE}${apiPath}`.replace("{id}", ctx.targetId);
        const body = {
            file_type: getMediaType(kind),
            file_data: base64,
            filename: fileName ?? "attachment",
        };
        if (ctx.msgId) {
            body.msg_id = ctx.msgId;
        }
        const resp = await fetch(fullUrl, {
            method: "POST",
            headers: {
                Authorization: `QQBot ${ctx.accessToken}`,
                "X-Union-Appid": ctx.appId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const errorText = await resp.text().catch(() => "");
            log.outbound.error(`Base64 upload failed: HTTP ${resp.status}`);
            return { channel: "qqbot", error: `HTTP ${resp.status}` };
        }
        const data = await resp.json();
        log.outbound.info(`Base64 media uploaded: file_uuid=${data.file_uuid}`);
        return sendMediaReference(ctx, kind, data.file_uuid, fileName);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.outbound.error(`Base64 upload failed: ${msg}`);
        return { channel: "qqbot", error: msg };
    }
}
/**
 * 发送媒体引用（文件上传后，调用消息 API 插入引用）
 */
async function sendMediaReference(ctx, kind, fileUuid, fileName) {
    // TODO: 实现媒体引用消息发送
    // 目前返回成功，但实际没有发送出去
    // 需要在 Phase 1.5 完善
    log.outbound.warn(`Media reference sending not yet implemented. file_uuid=${fileUuid}`);
    return {
        channel: "qqbot",
        error: "Media reference sending not yet implemented",
    };
}
// ============================================================================
// Helpers
// ============================================================================
function resolveLocalPath(path, extraLocalRoots) {
    // 简单实现：只允许绝对路径或相对于 cwd 的路径
    // 生产环境需要更严格的路径沙箱
    if (!path.startsWith("/") && !path.startsWith("./") && !path.startsWith("../")) {
        return { ok: false, error: `Invalid local path: ${path}` };
    }
    const resolved = join(process.cwd(), path);
    // 检查是否在允许的路径内
    const allowedRoots = [process.cwd(), ...(extraLocalRoots ?? [])];
    for (const root of allowedRoots) {
        if (resolved.startsWith(root)) {
            return { ok: true, path: resolved };
        }
    }
    return { ok: false, error: `Path not in allowed roots: ${path}` };
}
function buildMediaUploadPath(targetType, kind) {
    // Simplified - actual paths vary by type
    switch (targetType) {
        case "c2c":
            return `/v2/users/{id}/files`;
        case "group":
            return `/v2/groups/{id}/files`;
        case "channel":
        case "dm":
            return `/channels/{id}/messages`; // Media in channel uses messages API
        default:
            return `/v2/groups/{id}/files`;
    }
}
function getMediaType(kind) {
    // QQ API media types
    switch (kind) {
        case "image":
            return 1;
        case "video":
            return 2;
        case "voice":
            return 3;
        case "file":
            return 4;
        default:
            return 4;
    }
}
function getMimeType(kind, fileName) {
    if (fileName) {
        const ext = fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase();
        if (ext === "jpg" || ext === "jpeg")
            return "image/jpeg";
        if (ext === "png")
            return "image/png";
        if (ext === "gif")
            return "image/gif";
        if (ext === "webp")
            return "image/webp";
        if (ext === "mp4")
            return "video/mp4";
        if (ext === "pdf")
            return "application/pdf";
        if (ext === "zip")
            return "application/zip";
    }
    switch (kind) {
        case "image":
            return "image/png";
        case "video":
            return "video/mp4";
        case "voice":
            return "audio/wav";
        case "file":
            return "application/octet-stream";
    }
}
function getFileSize(path) {
    const { statSync } = require("fs");
    return statSync(path).size;
}
function basename(path) {
    return path.slice(path.lastIndexOf("/") + 1);
}
function formatFileSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
//# sourceMappingURL=media-sender.js.map