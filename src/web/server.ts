/**
 * Web Config UI Server - 轻量级配置管理界面
 *
 * 功能：
 * - GET /config → 显示当前配置表单
 * - POST /config → 保存配置并热重载
 * - GET /health → 健康检查
 *
 * 安全：
 * - 默认绑定 localhost 或通过 ALLOWED_ORIGINS 控制
 * - 可配置 basic auth (CONFIG_UI_USER / CONFIG_UI_PASS)
 *
 * 零外部依赖：使用 Node.js 原生 http 模块
 */

import { createServer, IncomingMessage, ServerResponse } from "http"
import { readFile, writeFile, mkdir } from "fs/promises"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { randomUUID } from "crypto"
import { log } from "../utils/logger.js"

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface WebConfigServerOptions {
  /** 监听端口，默认 3000 */
  port?: number
  /** 绑定地址，默认 127.0.0.1 */
  host?: string
  /** 配置根目录（存放 config.yaml 的目录） */
  configDir: string
  /** Basic Auth 用户名（可选） */
  username?: string
  /** Basic Auth 密码（可选） */
  password?: string
  /** 允许访问的来源（CORS） */
  allowedOrigins?: string[]
}

export class WebConfigServer {
  private options: WebConfigServerOptions
  private server: ReturnType<typeof createServer> | null = null

  constructor(options: WebConfigServerOptions) {
    this.options = {
      port: 3000,
      host: "127.0.0.1",
      allowedOrigins: ["http://localhost:3000"],
      ...options,
    }
  }

  async start(): Promise<void> {
    if (this.server) {
      throw new Error("Server already started")
    }

    this.server = createServer(async (req, res) => {
      await this.handleRequest(req, res)
    })

    this.server.listen(this.options.port, this.options.host, () => {
      log.config.info(`Web config UI listening on http://${this.options.host}:${this.options.port}`)
    })

    this.server.on("error", (err: any) => {
      log.config.error(`Web server error: ${err.message}`)
    })
  }

  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve, reject) => {
        this.server!.close((err) => (err ? reject(err) : resolve()))
      })
      this.server = null
      log.config.info("Web config UI stopped")
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const { method, url, headers } = req

    // CORS 预检
    if (method === "OPTIONS") {
      this.setCorsHeaders(res, headers)
      res.writeHead(204)
      res.end()
      return
    }

    // 身份验证（如果启用）
    if (this.options.username && this.options.password) {
      const auth = this.getAuthFromHeaders(headers)
      if (!auth || !this.checkAuth(auth)) {
        res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Config UI"' })
        res.end("Unauthorized")
        return
      }
    }

    // 路由处理
    try {
      if (method === "GET" && url === "/config") {
        await this.handleGetConfig(req, res)
      } else if (method === "POST" && url === "/config") {
        await this.handlePostConfig(req, res)
      } else if (method === "GET" && url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }))
      } else if (method === "GET" && (url === "/" || url === "/index.html")) {
        await this.serveStatic(res, "/index.html")
      } else if (method === "GET" && url?.startsWith("/ui/")) {
        await this.serveStatic(res, url)
      } else {
        res.writeHead(404)
        res.end("Not Found")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.config.error(`Request ${method} ${url} failed: ${msg}`)
      res.writeHead(500)
      res.end("Internal Server Error")
    }
  }

  private setCorsHeaders(res: ServerResponse, reqHeaders: IncomingMessage["headers"]): void {
    const origin = reqHeaders.origin
    if (this.options.allowedOrigins?.includes(origin ?? "")) {
      res.setHeader("Access-Control-Allow-Origin", origin)
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization")
    }
  }

  private getAuthFromHeaders(headers: IncomingMessage["headers"]): { user: string; pass: string } | null {
    const auth = headers.authorization
    if (!auth || !auth.startsWith("Basic ")) return null

    const b64 = auth.slice(6)
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8")
      const [user, pass] = decoded.split(":")
      return { user, pass }
    } catch {
      return null
    }
  }

  private checkAuth(auth: { user: string; pass: string }): boolean {
    return auth.user === this.options.username && auth.pass === this.options.password
  }

  private async handleGetConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 读取配置文件（支持 yaml/json）
    const yamlPath = join(this.options.configDir, "config.yaml")
    const jsonPath = join(this.options.configDir, "config.json")

    let configText: string
    try {
      configText = await readFile(yamlPath, "utf-8")
    } catch {
      try {
        configText = await readFile(jsonPath, "utf-8")
      } catch {
        // 配置文件不存在，返回空配置
        configText = "# No configuration file found. Create one below."
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ config: configText }))
  }

  private async handlePostConfig(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 解析 JSON body: { config: "yaml text" }
    const body = await this.readJsonBody(req)
    const yamlText = body.config

    if (typeof yamlText !== "string") {
      res.writeHead(400)
      res.end(JSON.stringify({ error: "Missing config field" }))
      return
    }

    // 保存配置文件
    const yamlPath = join(this.options.configDir, "config.yaml")
    await writeFile(yamlPath, yamlText, "utf-8")

    log.config.info(`Config updated via Web UI (${yamlText.length} bytes)`)

    // TODO: 触发热重载（需要与 ConfigLoader 集成，此处暂不实现）
    // 用户可以手动发送 SIGHUP 或重启进程

    res.writeHead(200)
    res.end(JSON.stringify({ success: true, message: "Configuration saved" }))
  }

  private async readJsonBody(req: IncomingMessage): Promise<any> {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks).toString("utf-8")
    return JSON.parse(body)
  }

  private async serveStatic(res: ServerResponse, path: string): Promise<void> {
    // 查找模板目录下的文件
    const filePath = join(__dirname, "ui", path === "/" ? "index.html" : path.substring(1))
    const ext = filePath.split(".").pop()?.toLowerCase()

    const mimeTypes: Record<string, string> = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
    }
    const mime = mimeTypes[ext ?? ""] ?? "application/octet-stream"

    try {
      const content = await readFile(filePath)
      res.writeHead(200, { "Content-Type": mime })
      res.end(content)
    } catch (err) {
      log.config.warn(`Static file not found: ${filePath}`)
      res.writeHead(404)
      res.end("Not Found")
    }
  }
}
