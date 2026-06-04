# standalone-qqbot

**独立运行的 QQ 机器人 SDK** — 零框架依赖，可嵌入任意 Node.js/AI 编程工具

[![npm version](https://img.shields.io/npm/v/standalone-qqbot.svg)](https://www.npmjs.com/package/standalone-qqbot)
[![Node.js](https://img.shields.io/node/v/standalone-qqbot.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/npm/l/standalone-qqbot.svg)](LICENSE)

---

## 📖 简介

`standalone-qqbot` 是一个完全独立的 QQ 机器人 SDK，基于 QQ 开放平台 WebSocket Gateway 构建。它将 OpenClaw QQBot 的核心功能提炼为纯 npm 包，**零框架依赖**，可嵌入任意 AI 编程工具（Claude Code、OpenCode、Cursor 等）或 Node.js 项目。

### 核心特性

- ✅ **完全独立** — 不依赖 OpenClaw 或任何 AI 框架
- ✅ **TypeScript** — 完整类型定义，IDE 友好
- ✅ **多账号支持** — 单客户端管理多个机器人
- ✅ **事件驱动** — EventEmitter 架构，松耦合设计
- ✅ **群组优化** — @门控、历史缓冲、消息合并
- ✅ **权限控制** — DM/Group 白名单策略
- ✅ **斜杠命令** — `/stop`、`/help` 等内置命令
- ✅ **媒体发送** — 文本/图片/视频/文件
- ✅ **配置热重载** — YAML/JSON 配置文件实时监控

### 与 OpenClaw QQBot 的区别

| 维度 | OpenClaw QQBot | standalone-qqbot |
|------|---------------|-----------------|
| 运行环境 | OpenClaw 插件 | 任意 Node.js 项目 |
| 依赖 | openclaw/plugin-sdk | 零框架依赖 |
| AI 集成 | 内置 AI Dispatcher | 事件发射 (`on('message')`) |
| 配置 UI | OpenClaw onboard | YAML/JSON 文件 |
| 安装方式 | OpenClaw 内置 | `npm install` |

---

## 🚀 快速开始

### 1. 安装

```bash
npm install standalone-qqbot
```

### 2. 创建配置文件

创建 `qqbot.yaml`：

```yaml
accounts:
  - appId: "111111111"              # 你的 AppID
    clientSecret: "your-secret"      # 你的 AppSecret
    dmPolicy: open                   # 私聊策略：open/allowlist/disabled
    groupPolicy: allowlist           # 群聊策略：open/allowlist/disabled
    allowFrom:                       # 私聊白名单（"*" 表示所有人）
      - "*"
    groupAllowFrom:                  # 群聊白名单（可选，默认用 allowFrom）
      - "843812FF4BA524086B77B60886C38AB3"
    groups:                          # 群组配置覆盖
      "*":                           # 默认配置
        requireMention: true         # 必须 @ 才响应
        historyLimit: 50             # 历史缓冲条数
      "specific-group-id":           # 特定群组覆盖
        requireMention: false
```

> 💡 **获取 AppID/AppSecret**: 前往 [QQ 开放平台](https://q.qq.com/) 创建机器人应用。

### 3. 编写代码

```typescript
import { QQBotClient } from 'standalone-qqbot'

// 创建客户端
const client = new QQBotClient({
  configPath: './qqbot.yaml',  // 配置文件路径
  debug: true                   // 启用调试日志
})

// 监听消息
client.on('message', async (ctx, account) => {
  console.log(`[${account.appId}] Received from ${ctx.event.senderId}:`)
  console.log(ctx.userContent)

  // 简单回复
  if (ctx.userContent.includes('你好')) {
    await client.sendText(ctx.isGroupChat ? 'group' : 'c2c', ctx.peerId, '你好！有什么可以帮你？')
  }

  // 发送图片
  if (ctx.userContent.includes('图片')) {
    await client.sendPhoto('group', ctx.peerId, '/path/to/image.jpg')
  }
})

// 监听连接状态
client.on('ready', (data, account) => {
  console.log(`✅ ${account.appId} 已连接`)
})

client.on('disconnect', (code, reason, account) => {
  console.log(`❌ ${account.appId} 断开：${reason}`)
})

client.on('error', (err, account) => {
  console.error(`⚠️ ${account.appId} 错误：${err.message}`)
})

// 启动连接
async function main() {
  try {
    await client.connect()
    console.log('🚀 机器人运行中... (Ctrl+C 停止)')
  } catch (err) {
    console.error('启动失败:', err)
    process.exit(1)
  }
}

main()
```

### 4. 运行

```bash
npx tsx your-bot.ts
# 或编译后运行
npm run build
node dist/your-bot.js
```

---

## 📚 API 参考

### 客户端方法

#### `new QQBotClient(options)`

```typescript
interface QQBotClientOptions {
  configPath?: string      // 配置文件路径（默认 ./qqbot.yaml）
  config?: QQBotConfig     // 直接传入配置对象（覆盖 configPath）
  dataDir?: string         // 数据目录（默认 ~/.standalone-qqbot）
  debug?: boolean          // 启用调试日志（默认 false）
}
```

#### `client.connect()`

连接到 QQ Gateway，为每个配置账号启动 WebSocket 连接。

#### `client.disconnect()`

断开所有连接，清理资源。

#### `client.sendText(targetType, targetId, content, options?)`

发送文本消息。

```typescript
type SendTargetType = 'c2c' | 'group' | 'channel' | 'dm'

await client.sendText('group', 'group-openid', 'Hello!', {
  msgId: 'reply-to-msg-id',  // 引用回复
  markdown: false            // 是否使用 markdown
})
```

#### `client.sendPhoto(targetType, targetId, imagePath, options?)`

发送图片（支持本地路径/URL/Base64）。

```typescript
// 本地文件
await client.sendPhoto('group', 'group-openid', '/path/to/image.jpg')

// URL
await client.sendPhoto('group', 'group-openid', 'https://example.com/image.png')

// Base64
await client.sendPhoto('group', 'group-openid', 'data:image/png;base64,iVBOR...')
```

#### `client.sendVideo(targetType, targetId, videoPath, options?)`

发送视频（同上）。

#### `client.sendDocument(targetType, targetId, filePath, options?)`

发送文件（同上）。

#### `client.registerCommand(command)`

注册自定义斜杠命令。

```typescript
client.registerCommand({
  name: 'echo',
  description: '回显消息',
  requireAuth: false,
  handler: async (ctx) => {
    return ctx.args  // 返回命令参数
  }
})
```

#### `client.getStatus()`

获取连接状态。

```typescript
const status = client.getStatus()
console.log(status)
// { connected: true, accounts: 1, connections: 1 }
```

### 事件

#### `'message'`

收到新消息（通过权限检查和群组门控后）。

```typescript
client.on('message', async (ctx, account) => {
  // ctx: InboundContext
  // account: ResolvedAccount
})
```

#### `'ready'`

机器人连接成功。

```typescript
client.on('ready', (data, account) => {
  console.log(`${account.appId} ready`)
})
```

#### `'disconnect'`

连接断开。

```typescript
client.on('disconnect', (code, reason, account) => {
  console.log(`Disconnected: ${reason}`)
})
```

#### `'error'`

发生错误。

```typescript
client.on('error', (err, account) => {
  console.error(err.message)
})
```

#### `'interaction'`

按钮交互事件。

```typescript
client.on('interaction', (data, account) => {
  // 处理按钮点击
})
```

#### `'access:denied'`

消息被权限控制拒绝。

```typescript
client.on('access:denied', (ctx, reason, account) => {
  console.log(`Blocked: ${reason}`)
})
```

#### `'group:skip'`

群组消息被门控跳过（未 @机器人）。

```typescript
client.on('group:skip', (ctx, reason, account) => {
  console.log(`Skipped: ${reason}`)
})
```

---

## ⚙️ 配置详解

### 账号配置

```yaml
accounts:
  - appId: "111111111"
    clientSecret: "your-secret"
    # 或使用文件
    clientSecretFile: "/path/to/secret.txt"

    # 私聊策略
    dmPolicy: open  # open | allowlist | disabled

    # 群聊策略
    groupPolicy: allowlist  # open | allowlist | disabled

    # 私聊白名单（支持 "*" 通配符和 "qqbot:" 前缀）
    allowFrom:
      - "*"  # 所有人
      - "qqbot:83FD44ADF621A074A3E91AEDF02B0704"  # 特定用户

    # 群聊白名单（可选，默认用 allowFrom）
    groupAllowFrom:
      - "843812FF4BA524086B77B60886C38AB3"

    # 全局系统提示（可选）
    systemPrompt: "你是一个有帮助的助手。"

    # 群组配置覆盖
    groups:
      # 默认配置（所有群组）
      "*":
        requireMention: true       # 必须 @ 才响应
        ignoreOtherMentions: false # 有其他人 @ 时忽略
        toolPolicy: "restricted"   # full | restricted | none
        name: ""                   # 群组显示名
        prompt: ""                 # 行为提示
        historyLimit: 50           # 历史缓冲条数

      # 特定群组覆盖
      "843812FF4BA524086B77B60886C38AB3":
        requireMention: false
        name: "VIP 群"
```

### 权限策略

| dmPolicy/groupPolicy | allowFrom 条件 | 结果 |
|---------------------|---------------|------|
| `open` | 包含 `"*"` | ✅ 允许所有人 |
| `open` | sender 在名单中 | ✅ 允许 |
| `open` | sender 不在名单中 | ❌ 拒绝 |
| `allowlist` | 名单为空 | ❌ 拒绝（空名单） |
| `allowlist` | sender 在名单中 | ✅ 允许 |
| `allowlist` | sender 不在名单中 | ❌ 拒绝 |
| `disabled` | 任意 | ❌ 拒绝（禁用） |

---

## 🔧 斜杠命令

内置命令：

| 命令 | 别名 | 需要授权 | 说明 |
|------|------|---------|------|
| `/stop` | `/s` | 否 | 紧急停止（跳过队列立即执行） |
| `/help` | `/h` | 否 | 显示帮助信息 |
| `/status` | — | 否 | 查看机器人状态 |
| `/reset` | — | 是 | 重置当前会话 |
| `/clear` | — | 是 | 清除历史缓冲 |
| `/ping` | — | 否 | 检查连接状态 |

自定义命令：

```typescript
client.registerCommand({
  name: 'weather',
  description: '查询天气',
  requireAuth: false,
  handler: async (ctx) => {
    const city = ctx.args || '北京'
    // 调用天气 API...
    return `今天 ${city} 晴朗，25°C`
  }
})
```

---

## 📊 项目结构

```
standalone-qqbot/
├── src/
│   ├── index.ts                 # 主入口
│   ├── types/                   # 类型定义
│   ├── config/                  # 配置系统
│   ├── gateway/                 # WebSocket 连接
│   ├── inbound/                 # 入站处理
│   ├── outbound/                # 出站消息
│   ├── group/                   # 群组处理
│   ├── commands/                # 斜杠命令
│   └── adapter/                 # 客户端封装
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🛠️ 开发

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 编译
npm run build

# 开发模式
npm run dev
```

---

## ⚠️ 注意事项

1. **Token 有效期**: access_token 有效期 24 小时，SDK 会自动刷新
2. **消息合并**: 同群组 5 秒内多条消息会合并为一个 AI turn
3. **文件大小**: 图片 < 30MB，视频/文件 < 100MB（分块上传待实现）
4. **语音处理**: 语音消息解码和 STT 暂缓（P2 实现）
5. **会话持久化**: Session 保存在 `~/.standalone-qqbot/sessions/`

---

## 📄 License

MIT

---

## 🙏 致谢

本项目的架构设计参考了 [OpenClaw QQBot](https://github.com/openclaw/openclaw) 源码，已完全重写并独立实现。

---

**QQ 开放平台文档**: https://bot.q.qq.com/wiki/

**npm 包**: https://www.npmjs.com/package/standalone-qqbot

**GitHub**: https://github.com/your-repo/standalone-qqbot