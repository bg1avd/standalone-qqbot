# QQBot SDK — 独立运行的 QQ 机器人 SDK

**项目名称**: `standalone-qqbot`
**日期**: 2026-06-04
**状态**: Phase 1 全部完成 (100%✅)，Phase 2.1-2.2 完成，Phase 2.3 进行中
**语音处理**: Phase 2.3 进行中

---

## ⚠️ 名词解释：gateway 是什么？

**`gateway` 在本项目中 = QQ 开放平台的 WebSocket 网关地址**（`wss://api.sgroup.qq.com`），这是 QQ 官方术语，指机器人连接的 QQ 服务器入口。

本项目代码中所有 `gateway` 命名（`GatewayConnection`、`connectToGateway`、`getGatewayUrl`）均指代 **QQ 官方的 WebSocket 连接层**，与 OpenClaw 框架完全无关。

---

## 一、项目定位

### 1.1 核心目标

将 `@openclaw/qqbot` 的核心逻辑提炼为**独立运行的 Node.js SDK**，通过 `npm install standalone-qqbot` 安装到任意 AI 编程工具（Claude Code、OpenCode、Cursor 等），填入 AppID/AppSecret 即可工作。

**与 OpenClaw 完全解耦**：
- 不依赖 OpenClaw 任何模块
- 不依赖 `openclaw/plugin-sdk`
- 零框架依赖，纯粹的 Node.js 包
- 消息通过事件发射器抛出 (`client.on('message', ctx => ...)`)，由接入方决定如何处理

### 1.2 架构借鉴说明

本项目从 `@openclaw/qqbot` 源码中提取架构思路进行分析（已获授权），但全部重写：

| 维度 | OpenClaw QQBot | standalone-qqbot |
|------|---------------|-----------------|
| 运行环境 | OpenClaw 插件 | 任意 Node.js 项目 |
| AI 集成 | 内置 AI Dispatcher | 事件发射 (`on('message')`) |
| 审批 | OpenClaw 审批系统 | 按钮回调（内置） |
| 路由 | OpenClaw Agent 路由 | 无路由，消息直接抛出 |
| 语音 | silk-wasm + STT | P2 暂缓 |

### 1.3 关键技术选型

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 运行时 | Node.js ≥ 18.0.0 | 原生 ESM + fetch |
| WebSocket | ws@^8 | QQ 官方连接 |
| 配置校验 | Zod@3 | 类型安全配置 |
| 配置解析 | yaml@^2 | YAML 文件支持 |
| 日志 | debug@^4 | 命名空间调试 |

---

## 二、Phase 1 功能范围（当前进行中）

### 包含
- ✅ WebSocket Gateway 连接与重连
- ✅ Token 自动刷新
- ✅ 消息接收与分发（c2c/dm/group/guild）
- ✅ 文本消息发送
- ✅ 图片发送（本地/URL/Base64）
- ✅ 视频发送（本地/URL）
- ✅ 文件发送（本地/URL）
- ✅ 分块上传（大文件）
- ✅ DM/Group 权限控制（allowlist/open/disabled）
- ✅ 群组 mention 门控（requireMention/ignoreOtherMentions）
- ✅ 群组历史缓冲
- ✅ 引用消息解析（refMsgIdx）
- ✅ 斜杠命令系统（/stop 等）
- ✅ QQ Emoji 标签解析
- ✅ 多账号支持
- ✅ 配置管理（YAML/JSON）

### 暂缓（P2）
- ❌ 语音消息接收（silk-wasm 解码）
- ❌ 语音发送（SILK 编码）
- ❌ STT 语音转文字

---

## 三、实现状态

### ✅ 已完成

```
src/types/index.ts         核心类型定义
src/config/schema.ts       Zod 配置 schema
src/config/loader.ts       YAML/JSON 配置加载 + 热重载
src/config/index.ts        模块导出
src/utils/logger.ts         debug 日志（qqbot:* 命名空间）
src/utils/retry.ts          HTTP 重试 + sleep 工具
src/gateway/token.ts        Token 管理器（24h TTL + 自动刷新）
src/gateway/reconnect.ts    重连状态机（指数退避、QQ 特定 close code）
src/gateway/message-queue.ts Per-peer 并发队列（全局10并发、容量20/50）
src/gateway/connection.ts    WebSocket Gateway 连接（hello/identify/resume/heartbeat）
src/gateway/index.ts        模块导出
```

### Phase 1.2 完成详情

| 任务 | 状态 |
|------|------|
| T1.2.1 Token 管理器 | ✅ |
| T1.2.2 WebSocket Gateway 连接 | ✅ |
| T1.2.3 重连状态机 | ✅ |
| T1.2.4 Event 分发器 | ✅ |
| T1.2.5 Per-peer 并发队列 | ✅ |

### 🔨 Phase 1.3 进行中

| 任务 | 状态 |
|------|------|
| T1.3.1 Access 控制（dmPolicy/groupPolicy + allowFrom 匹配） | ⏳ 待开始 |
| T1.3.2 附件下载（图片/视频/文件 → 本地） | ⏳ 待开始 |
| T1.3.3 用户内容解析（Emoji 标签、mention 清理） | ⏳ 待开始 |
| T1.3.4 引用消息解析（refMsgIdx 缓存 + msg_elements 回退） | ⏳ 待开始 |
| T1.3.5 RefIdx 缓存管理（TTL 300s） | ⏳ 待开始 |
| T1.3.6 入站上下文构建（8-stage pipeline） | ⏳ 待开始 |

### 后续阶段

| Phase | 名称 | 说明 |
|-------|------|------|
| 1.4 | 群组处理 | mention 检测、门控决策、历史缓冲、消息合并 |
| 1.5 | 出站消息 | 文本/图片/视频/文件发送、分块上传 |
| 1.6 | 斜杠命令 | 命令解析、内置命令、授权检查 |
| 1.7 | 配置系统 | ✅ 已完成 |
| 1.8 | 集成胶水层 | AI Handler 接口、事件发射器、生命周期管理 |

---

## 四、目录结构

```
standalone-qqbot/
├── src/
│   ├── index.ts                    # 主入口，导出 QQBotClient 类
│   ├── types/index.ts              # 核心类型定义（已完成）
│   ├── config/
│   │   ├── schema.ts               # Zod 配置 schema（已完成）
│   │   ├── loader.ts               # YAML/JSON 配置加载（已完成）
│   │   └── index.ts
│   ├── gateway/                    # Gateway = QQ WebSocket 连接层
│   │   ├── token.ts                # Token 管理器（已完成）
│   │   ├── reconnect.ts           # 重连状态机（已完成）
│   │   ├── message-queue.ts        # Per-peer 队列（已完成）
│   │   ├── connection.ts          # WebSocket 连接（已完成）
│   │   └── index.ts
│   ├── inbound/                    # 入站消息处理
│   │   ├── access.ts               # 权限控制
│   │   ├── content-parser.ts       # Emoji/mention 解析
│   │   ├── attachment-processor.ts # 附件下载
│   │   ├── quote-resolver.ts       # 引用解析
│   │   ├── ref-index.ts            # 引用缓存
│   │   └── context-builder.ts      # 入站上下文构建
│   ├── group/
│   │   ├── gate.ts                 # 群组门控
│   │   ├── history.ts              # 历史缓冲
│   │   ├── merger.ts               # 消息合并
│   │   └── mention-detector.ts    # mention 检测
│   ├── outbound/
│   │   ├── sender.ts               # 文本发送
│   │   ├── media-sender.ts        # 媒体发送
│   │   ├── chunked-upload.ts       # 分块上传
│   │   └── path-guard.ts          # 路径安全校验
│   ├── commands/
│   │   ├── parser.ts               # 命令解析
│   │   ├── builtins.ts            # 内置命令
│   │   └── registry.ts            # 命令注册表
│   └── adapter/
│       ├── ai-handler.ts          # AI handler 接口
│       └── event-emitter.ts       # 事件发射器
├── tests/
├── package.json
├── tsconfig.json
├── SPEC.md
└── STATUS.md
```

---

*文档版本: v1.2*
*下次更新: Phase 1.3 完成后*