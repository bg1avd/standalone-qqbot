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
import type { MediaKind } from "../types/index.js";
export interface ChunkedUploadOptions {
    /** 并发上传的 block 数 */
    concurrency?: number;
    /** 每块大小（由服务器返回，通常 5MB） */
    blockSize?: number;
    /** 进度回调 */
    onProgress?: (uploaded: number, total: number) => void;
}
export interface UploadResult {
    fileUuid: string;
    fileInfo: string;
}
/**
 * 分块上传器 Context
 */
export interface ChunkedUploadContext {
    appId: string;
    accessToken: string;
    targetType: "c2c" | "group" | "channel" | "dm";
    targetId: string;
}
/**
 * 分块上传器
 */
export declare class ChunkedUploader {
    private concurrency;
    private blockSize;
    constructor(options?: ChunkedUploadOptions);
    /**
     * 上传大文件
     */
    uploadFile(ctx: ChunkedUploadContext, kind: MediaKind, filePath: string, fileName: string, options?: ChunkedUploadOptions): Promise<UploadResult>;
    /**
     * Step 1: 调用 /upload_prepare 获取分块信息
     */
    private prepareUpload;
    /**
     * Step 2: 分块上传所有 blocks（并发控制）
     */
    private uploadBlocks;
    /**
     * 上传单个 block 到 COS URL
     */
    private uploadBlock;
    /**
     * Step 3: 确认单个 part 完成
     */
    private confirmPart;
    /**
     * Step 4: 完成上传（合并所有 parts）
     */
    private completeUpload;
    private buildUploadPreparePath;
    private getTargetResource;
    private getMediaType;
}
/**
 * 便捷函数：单次大文件上传
 */
export declare function uploadLargeFile(ctx: {
    appId: string;
    accessToken: string;
    targetType: "c2c" | "group";
    targetId: string;
}, kind: MediaKind, filePath: string, fileName: string, options?: ChunkedUploadOptions): Promise<UploadResult>;
//# sourceMappingURL=chunked-upload.d.ts.map