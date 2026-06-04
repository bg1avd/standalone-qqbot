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

import { EventEmitter } from "events"
import { AbortController } from "node-abort-controller"
import { loadConfig, loadConfigWithDefaults } from "../config/loader.js"
import { GatewayConnection, type GatewayEvents } from "../gateway/index.js"
import { getAccessToken } from "../gateway/token.js"
import { buildInboundContext } from "../inbound/index.js"
import { sendText, sendPhoto, sendVideo, sendDocument, sendVoice } from "../outbound/index.js"
import { CommandRegistry, parseSlashCommand } from "../commands/index.js"
import type { WebConfigServer } from "../web/index.js"
import { QQBotEventEmitter } from "./event-emitter.js"
import type {
  QQBotClientOptions,
  QQBotConfig,
  ResolvedAccount,
  QueuedMessage,
  InboundContext,
  SendResult,
  SendTargetType,
  SlashCommand,
} from "../types/index.js"
import { log, setGlobalEnabled } from "../utils/logger.js"
import { flushAllTokens } from "../gateway/token.js"
import { clearRefIndex } from "../inbound/ref-index.js"
import { clearAllHistory } from "../group/history.js"

export class QQBotClient extends QQBotEventEmitter {
  private config: QQBotConfig | null = null
  private connections: Map<string, GatewayConnection> = new Map()
  private commandRegistry = new CommandRegistry()
  private abortControllers: Map<string, any> = new Map()
  private connected = false
  private dataDir: string
  private webServer: any = null

  constructor(private options: QQBotClientOptions = {}) {
    super()
    this.dataDir = options.dataDir ?? `${process.env.HOME}/.standalone-qqbot`

    // 启用 debug 日志
    if (options.debug) {
      setGlobalEnabled(true)
    }

    // 加载配置
    if (options.config) {
      this.config = options.config
    } else if (options.configPath) {
      this.config = loadConfig(options.configPath)
    }
  }

  /**
   * 连接到 QQ Gateway
   *
   * 会为每个账号启动一个独立的 WebSocket 连接。
   */
  async connect(): Promise<void> {
    if (this.connected) {
      log.gateway.warn("Already connected, ignoring connect() call")
      return
    }

    // 加载配置（如果还没有）
    if (!this.config) {
      this.config = loadConfigWithDefaults(this.dataDir)
    }

    log.gateway.info("Connecting with %d account(s)", this.config.accounts.length)

    // 启动 Web Config UI（如果启用）
    await this.startWebServerIfNeeded()

    // 为每个账号启动连接
    for (const accountConfig of this.config.accounts) {
      const account: ResolvedAccount = {
        appId: accountConfig.appId,
        clientSecret: accountConfig.clientSecret,
        config: accountConfig,
        accountId: `${accountConfig.appId}`,
      }

      await this.connectAccount(account)
    }

    this.connected = true
    log.gateway.info("All accounts connected")
  }

  /**
   * 连接单个账号
   */
  private async connectAccount(account: ResolvedAccount): Promise<void> {
    log.gateway.info("Connecting account: %s", account.appId)

    const abortController = new AbortController()
    this.abortControllers.set(account.accountId, abortController)

    const gatewayEvents: GatewayEvents = {
      onReady: (data) => {
        log.gateway.info("Account %s ready", account.appId)
        this.emit("ready", data, account)
      },
      onResumed: (data) => {
        log.gateway.info("Account %s resumed", account.appId)
        this.emit("resumed", data, account)
      },
      onInteraction: (data) => {
        this.emit("interaction", data, account)
      },
      onMessage: async (msg) => {
        await this.handleMessage(msg, account)
      },
      onDisconnect: (code, reason) => {
        log.gateway.info("Account %s disconnected: code=%d reason=%s", account.appId, code, reason)
        this.emit("disconnect", code, reason, account)
      },
      onError: (err) => {
        log.gateway.error("Account %s error: %s", account.appId, err.message)
        this.emit("error", err, account)
      },
    }

    const connection = new GatewayConnection({
      account,
      abortSignal: abortController.signal as AbortSignal,
      handleMessage: async (msg: QueuedMessage) => {
        gatewayEvents.onMessage(msg)
      },
      getMessagePeerId: (msg) => this.resolvePeerId(msg),
      events: gatewayEvents,
    })

    this.connections.set(account.accountId, connection)

    // 启动连接（非阻塞）
    connection.start().catch((err) => {
      log.gateway.error("Connection failed for %s: %s", account.appId, err.message)
      this.emit("error", err, account)
    })
  }

  /**
   * 处理单条消息
   */
  private async handleMessage(msg: QueuedMessage, account: ResolvedAccount): Promise<void> {
    // 检查是否是斜杠命令
    const cmd = parseSlashCommand(msg.content)
    if (cmd) {
      log.command.debug(`Slash command detected: /${cmd.name}`)
      // TODO: 执行命令
      return
    }

    // 构建入站上下文
    try {
      const ctx = await buildInboundContext(msg, account.config)

      if (ctx.blocked) {
        log.access.info(`Message blocked: ${ctx.blockReason}`)
        this.emit("access:denied", ctx, ctx.blockReason ?? "Unknown", account)
        return
      }

      if (ctx.skipped) {
        log.group.debug?.(`Message skipped: ${ctx.skipReason}`)
        this.emit("group:skip", ctx, ctx.skipReason ?? "Unknown", account)
        return
      }

      // 抛消息事件
      this.emit("message", ctx, account)
    } catch (err) {
      log.inbound.error(`Failed to build context: %s`, err instanceof Error ? err.message : String(err))
      this.emit("error", err instanceof Error ? err : new Error(String(err)), account)
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    log.gateway.info("Disconnecting...")

    // 停止所有连接
    for (const [accountId, controller] of this.abortControllers.entries()) {
      controller.abort()
      this.abortControllers.delete(accountId)
    }

    // 等待一小段时间让连接关闭
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 清理资源
    this.connections.clear()
    flushAllTokens()
    clearRefIndex()
    clearAllHistory()

    this.connected = false
    log.gateway.info("Disconnected")
  }

  /**
   * 发送文本消息
   */
  async sendText(
    targetType: SendTargetType,
    targetId: string,
    content: string,
    options?: { msgId?: string; markdown?: boolean }
  ): Promise<SendResult> {
    if (!this.config || this.config.accounts.length === 0) {
      return { channel: "qqbot", error: "No account configured" }
    }

    const account = this.config.accounts[0]
    return sendText(
      account.appId,
      await getAccessToken(account.appId, account.clientSecret),
      targetType,
      targetId,
      content,
      options
    )
  }

  /**
   * 发送图片
   */
  async sendPhoto(
    targetType: SendTargetType,
    targetId: string,
    imagePath: string,
    options?: { msgId?: string; fileName?: string }
  ): Promise<SendResult> {
    if (!this.config || this.config.accounts.length === 0) {
      return { channel: "qqbot", error: "No account configured" }
    }

    const account = this.config.accounts[0]
    const accessToken = await getAccessToken(account.appId, account.clientSecret)

    return sendPhoto(
      { appId: account.appId, accessToken, targetType, targetId, msgId: options?.msgId },
      imagePath,
      options
    )
  }

  /**
   * 发送视频
   */
  async sendVideo(
    targetType: SendTargetType,
    targetId: string,
    videoPath: string,
    options?: { msgId?: string; fileName?: string }
  ): Promise<SendResult> {
    if (!this.config || this.config.accounts.length === 0) {
      return { channel: "qqbot", error: "No account configured" }
    }

    const account = this.config.accounts[0]
    const accessToken = await getAccessToken(account.appId, account.clientSecret)

    return sendVideo(
      { appId: account.appId, accessToken, targetType, targetId, msgId: options?.msgId },
      videoPath,
      options
    )
  }

  /**
   * 发送文件
   */
  async sendDocument(
    targetType: SendTargetType,
    targetId: string,
    filePath: string,
    options?: { msgId?: string; fileName?: string }
  ): Promise<SendResult> {
    if (!this.config || this.config.accounts.length === 0) {
      return { channel: "qqbot", error: "No account configured" }
    }

    const account = this.config.accounts[0]
    const accessToken = await getAccessToken(account.appId, account.clientSecret)

    return sendDocument(
      { appId: account.appId, accessToken, targetType, targetId, msgId: options?.msgId },
      filePath,
      options
    )
  }

  /**
   * 发送语音
   */
  async sendVoice(
    targetType: SendTargetType,
    targetId: string,
    audioPath: string,
    options?: { fileName?: string }
  ): Promise<SendResult> {
    if (!this.config || this.config.accounts.length === 0) {
      return { channel: "qqbot", error: "No account configured" }
    }

    const account = this.config.accounts[0]
    const accessToken = await getAccessToken(account.appId, account.clientSecret)

    return sendVoice(
      { appId: account.appId, accessToken, targetType, targetId },
      audioPath,
      options
    )
  }

  /**
   * 注册自定义命令
   */
  registerCommand(command: SlashCommand): void {
    this.commandRegistry.register(command)
  }

  /**
   * 获取连接状态
   */
  getStatus(): {
    connected: boolean
    accounts: number
    connections: number
    webConfig?: { port: number; host: string; running: boolean }
  } {
    return {
      connected: this.connected,
      accounts: this.config?.accounts.length ?? 0,
      connections: this.connections.size,
      webConfig: this.webServer ? { port: this.options.webConfig?.port ?? 3000, host: this.options.webConfig?.host ?? '127.0.0.1', running: true } : undefined,
    }
  }

  /**
   * 按需启动 Web 配置服务器
   */
  private async startWebServerIfNeeded(): Promise<void> {
    if (!this.options.webConfig) {
      return
    }
    if (this.webServer) {
      log.config.warn("Web config server already running")
      return
    }

    const { WebConfigServer } = await import("../web/server.js")
    this.webServer = new WebConfigServer({
      configDir: this.dataDir,
      port: this.options.webConfig.port,
      host: this.options.webConfig.host,
      username: this.options.webConfig.username,
      password: this.options.webConfig.password,
      allowedOrigins: this.options.webConfig.allowedOrigins,
    })

    try {
      await this.webServer.start()
      log.config.info("Web config UI started on %s:%d", this.options.webConfig.host, this.options.webConfig.port)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.config.error("Failed to start web server: %s", msg)
      this.webServer = null
    }
  }

  /**
   * 解析 peer ID
   */
  private resolvePeerId(msg: QueuedMessage): string {
    if (msg.type === "group" && msg.groupOpenid) return `group:${msg.groupOpenid}`
    if (msg.type === "guild" && msg.channelId) return `channel:${msg.channelId}`
    if (msg.type === "dm" && msg.guildId) return `dm:${msg.guildId}`
    return `c2c:${msg.senderId}`
  }
}