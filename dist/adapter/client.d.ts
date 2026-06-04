/**
 * QQBotClient — 主 Client 类
 *
 * 整合所有模块，提供统一的 API 入口：
 * - 连接管理（connect/disconnect）
 * - 消息发送（sendText/sendPhoto/sendVideo/sendDocument）
 * - 事件监听（on/off/once）
 * - 命令注册（registerCommand）
 *
 * 使用示例：
 * ```typescript
 * const client = new QQBotClient({ configPath: './qqbot.yaml' })
 *
 * client.on('message', async (ctx) => {
 *   console.log('Received:', ctx.userContent)
 *   await client.sendText(ctx.peerId, 'Hello!')
 * })
 *
 * await client.connect()
 * ```
 */
import { QQBotEventEmitter } from "./event-emitter.js";
import type { QQBotClientOptions, SendResult, SendTargetType, SlashCommand } from "../types/index.js";
export declare class QQBotClient extends QQBotEventEmitter {
    private options;
    private config;
    private connections;
    private commandRegistry;
    private abortControllers;
    private connected;
    private dataDir;
    private webServer;
    constructor(options?: QQBotClientOptions);
    /**
     * 连接到 QQ Gateway
     *
     * 会为每个账号启动一个独立的 WebSocket 连接。
     */
    connect(): Promise<void>;
    /**
     * 连接单个账号
     */
    private connectAccount;
    /**
     * 处理单条消息
     */
    private handleMessage;
    /**
     * 断开连接
     */
    disconnect(): Promise<void>;
    /**
     * 发送文本消息
     */
    sendText(targetType: SendTargetType, targetId: string, content: string, options?: {
        msgId?: string;
        markdown?: boolean;
    }): Promise<SendResult>;
    /**
     * 发送图片
     */
    sendPhoto(targetType: SendTargetType, targetId: string, imagePath: string, options?: {
        msgId?: string;
        fileName?: string;
    }): Promise<SendResult>;
    /**
     * 发送视频
     */
    sendVideo(targetType: SendTargetType, targetId: string, videoPath: string, options?: {
        msgId?: string;
        fileName?: string;
    }): Promise<SendResult>;
    /**
     * 发送文件
     */
    sendDocument(targetType: SendTargetType, targetId: string, filePath: string, options?: {
        msgId?: string;
        fileName?: string;
    }): Promise<SendResult>;
    /**
     * 发送语音
     */
    sendVoice(targetType: SendTargetType, targetId: string, audioPath: string, options?: {
        fileName?: string;
    }): Promise<SendResult>;
    /**
     * 注册自定义命令
     */
    registerCommand(command: SlashCommand): void;
    /**
     * 获取连接状态
     */
    getStatus(): {
        connected: boolean;
        accounts: number;
        connections: number;
        webConfig?: {
            port: number;
            host: string;
            running: boolean;
        };
    };
    /**
     * 按需启动 Web 配置服务器
     */
    private startWebServerIfNeeded;
    /**
     * 解析 peer ID
     */
    private resolvePeerId;
}
//# sourceMappingURL=client.d.ts.map