/**
 * Chunked Uploader — 大文件分块上传到 QQ 文件服务
 *
 * 流程：
 * 1. POST /upload_prepare → 获取 upload_id, block_size, COS_urls[]
 * 2. 并行/串行 PUT 每个 block 到对应的 COS_url
 * 3. POST /upload_part_finish 确认每个 part
 * 4. POST /complete_upload 完成 → 返回 file_uuid
 *
 * 参考：OpenClaw QQBot outbound-BJfhwrPg.js 的分块逻辑
 */
import { promises as fs } from "fs";
import { log } from "../utils/logger.js";
const API_BASE = "https://api.q.qq.com";
/**
 * 分块上传器
 */
export class ChunkedUploader {
    concurrency;
    blockSize;
    constructor(options = {}) {
        this.concurrency = options.concurrency ?? 3;
        this.blockSize = options.blockSize ?? 5 * 1024 * 1024; // 5MB default
    }
    /**
     * 上传大文件
     */
    async uploadFile(ctx, kind, filePath, fileName, options = {}) {
        const { onProgress } = options;
        log.chunked.info(`Starting chunked upload: ${filePath} (${kind})`);
        // 1. 准备上传
        const prepare = await this.prepareUpload(ctx, kind, filePath, fileName);
        log.chunked.debug(`Prepare: uploadId=${prepare.uploadId}, blocks=${prepare.cosUrls.length}, size=${prepare.fileSize}`);
        // 2. 分块上传
        await this.uploadBlocks(ctx, prepare, filePath, onProgress);
        // 3. 完成上传
        const result = await this.completeUpload(ctx, prepare.uploadId);
        log.chunked.info(`Upload complete: fileUuid=${result.fileUuid}`);
        return result;
    }
    /**
     * Step 1: 调用 /upload_prepare 获取分块信息
     */
    async prepareUpload(ctx, kind, filePath, fileName) {
        const fileStats = await fs.stat(filePath);
        const fileSize = fileStats.size;
        const apiPath = this.buildUploadPreparePath(ctx.targetType, kind);
        const url = `${API_BASE}${apiPath}`.replace("{id}", ctx.targetId);
        const body = {
            file_type: this.getMediaType(kind),
            filename: fileName,
            file_size: fileSize,
        };
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `QQBot ${ctx.accessToken}`,
                "X-Union-Appid": ctx.appId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const error = await resp.text().catch(() => "Unknown error");
            throw new Error(`Upload prepare failed: HTTP ${resp.status} - ${error}`);
        }
        const data = await resp.json();
        return {
            uploadId: data.upload_id,
            blockSize: data.block_size,
            cosUrls: data.COS_urls,
            fileSize,
        };
    }
    /**
     * Step 2: 分块上传所有 blocks（并发控制）
     */
    async uploadBlocks(ctx, prepare, filePath, onProgress) {
        const { appId, accessToken } = ctx; // 解构用于 admit logic，实际不使用
        const { uploadId, cosUrls, blockSize } = prepare;
        const totalSize = prepare.fileSize;
        // 计算每个 block 的范围
        const blocks = cosUrls.map((url, idx) => ({
            url,
            start: idx * blockSize,
            end: Math.min((idx + 1) * blockSize, totalSize),
        }));
        // 并发上传（控制并发数）
        const semaphore = new Array(this.concurrency).fill(null);
        let currentBlock = 0;
        let uploadedBytes = 0;
        const uploadOne = async () => {
            while (currentBlock < blocks.length) {
                const blockIdx = currentBlock++;
                const block = blocks[blockIdx];
                try {
                    await this.uploadBlock(filePath, block);
                    uploadedBytes += block.end - block.start;
                    if (onProgress) {
                        onProgress(uploadedBytes, totalSize);
                    }
                    log.chunked.debug(`Block ${blockIdx + 1}/${blocks.length} uploaded (${block.end - block.start} bytes)`);
                }
                catch (err) {
                    log.chunked.error(`Block ${blockIdx} failed: ${err}`);
                    throw err;
                }
            }
        };
        // 启动并发 workers
        const workers = semaphore.map(() => uploadOne());
        await Promise.all(workers);
        log.chunked.info(`All ${blocks.length} blocks uploaded`);
    }
    /**
     * 上传单个 block 到 COS URL
     */
    async uploadBlock(filePath, block) {
        const fileBuffer = await fs.readFile(filePath);
        const buffer = fileBuffer.slice(block.start, block.end);
        const resp = await fetch(block.url, {
            method: "PUT",
            headers: {
                "Content-Type": "application/octet-stream",
            },
            body: buffer,
        });
        if (!resp.ok && resp.status !== 206 && resp.status !== 200) {
            // 206 Partial Content 是可接受的
            throw new Error(`Block upload failed: HTTP ${resp.status}`);
        }
    }
    /**
     * Step 3: 确认单个 part 完成
     */
    async confirmPart(ctx, uploadId, partNumber) {
        const url = `${API_BASE}/v2/users/{id}/upload_part_finish`.replace("{id}", ctx.targetId); // TODO: 确认实际路径
        const body = {
            upload_id: uploadId,
            part_number: partNumber,
        };
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `QQBot ${ctx.accessToken}`,
                "X-Union-Appid": ctx.appId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            throw new Error(`Part confirm failed: HTTP ${resp.status}`);
        }
    }
    /**
     * Step 4: 完成上传（合并所有 parts）
     */
    async completeUpload(ctx, uploadId) {
        const apiPath = `/v2/${this.getTargetResource(ctx.targetType)}/{id}/complete_upload`;
        const url = `${API_BASE}${apiPath}`.replace("{id}", ctx.targetId);
        const body = {
            upload_id: uploadId,
        };
        const resp = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `QQBot ${ctx.accessToken}`,
                "X-Union-Appid": ctx.appId,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const error = await resp.text().catch(() => "Unknown error");
            throw new Error(`Complete upload failed: HTTP ${resp.status} - ${error}`);
        }
        const data = await resp.json();
        return {
            fileUuid: data.file_uuid,
            fileInfo: data.file_info ?? "{}",
        };
    }
    // ============================================================================
    // Helpers
    // ============================================================================
    buildUploadPreparePath(targetType, kind) {
        // 根据 targetType 和 kind 返回正确的路径
        // Examples:
        //   c2c + image → /v2/users/{id}/upload_prepare
        //   group + file → /v2/groups/{id}/upload_prepare
        const resource = this.getTargetResource(targetType);
        return `/v2/${resource}/{id}/upload_prepare`;
    }
    getTargetResource(targetType) {
        switch (targetType) {
            case "c2c":
            case "dm":
                return "users";
            case "group":
                return "groups";
            case "channel":
            case "guild":
                return "channels";
            default:
                return "groups";
        }
    }
    getMediaType(kind) {
        switch (kind) {
            case "image":
                return 1;
            case "video":
                return 2;
            case "voice":
                return 3;
            case "file":
                return 4;
        }
    }
}
/**
 * 便捷函数：单次大文件上传
 */
export async function uploadLargeFile(ctx, kind, filePath, fileName, options = {}) {
    const uploader = new ChunkedUploader(options);
    return uploader.uploadFile(ctx, kind, filePath, fileName, options);
}
//# sourceMappingURL=chunked-upload.js.map