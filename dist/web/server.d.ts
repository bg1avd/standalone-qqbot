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
export interface WebConfigServerOptions {
    /** 监听端口，默认 3000 */
    port?: number;
    /** 绑定地址，默认 127.0.0.1 */
    host?: string;
    /** 配置根目录（存放 config.yaml 的目录） */
    configDir: string;
    /** Basic Auth 用户名（可选） */
    username?: string;
    /** Basic Auth 密码（可选） */
    password?: string;
    /** 允许访问的来源（CORS） */
    allowedOrigins?: string[];
}
export declare class WebConfigServer {
    private options;
    private server;
    constructor(options: WebConfigServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    private handleRequest;
    private setCorsHeaders;
    private getAuthFromHeaders;
    private checkAuth;
    private handleGetConfig;
    private handlePostConfig;
    private readJsonBody;
    private serveStatic;
}
//# sourceMappingURL=server.d.ts.map