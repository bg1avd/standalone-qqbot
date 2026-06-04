# OpenClaw QQBot 源码分析报告

**分析日期**: 2026-06-03
**插件版本**: @openclaw/qqbot@2026.5.3
**Channel ID**: `qqbot`

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────┐
│                  OpenClaw Gateway                    │
│  ┌─────────────────────────────────────────────┐    │
│  │         QQBot Plugin (index.js)              │    │
│  │  ┌──────────────┐  ┌────────────────────┐  │    │
│  │  │ Setup Plugin │  │  Runtime Plugin    │  │    │
│  │  │(onboard向导) │  │  (Gateway连接)      │  │    │
│  │  └──────────────┘  └────────────────────┘  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────┐
│         QQ Open Platform WebSocket Gateway          │
│                 wss://api.sgroup.qq.com              │
└─────────────────────────────────────────────────────┘
```

---

## 二、消息流：入站

```
QQ Server (WebSocket push)
    │
    ▼
gateway-CmSUJKSt.js: ws.on("message")
    │
    ├── JSON.parse → { op, d, s, t }
    │
    ├── op=HELLO(10) → handleHello() → send IDENTIFY or RESUME
    │
    ├── op=DISPATCH(0) → dispatchEvent(t, d)
    │       │
    │       ├── READY/RESUMED → 保存 session
    │       ├── C2C_MESSAGE_CREATE → type="c2c"
    │       ├── AT_MESSAGE_CREATE → type="guild"
    │       ├── DIRECT_MESSAGE_CREATE → type="dm"
    │       ├── GROUP_AT_MESSAGE_CREATE → type="group"
    │       ├── GROUP_MESSAGE_CREATE → type="group"（背景）
    │       ├── INTERACTION_CREATE → onInteraction()
    │       └── ignore → 丢弃
    │
    ├── trySlashCommand() → /stop 等紧急命令
    │       │ 结果: "handled" / "enqueue" / "urgent"
    │
    └── msgQueue.enqueue() 或 executeImmediate()
            │
            ▼
        Per-Peer 队列（全局10并发）
            │
            ▼
        buildInboundContext() [8-stage pipeline]
            │
            ├─ Stage1: runAccessStage()  ← 权限检查
            ├─ Stage2: processAttachments()  ← 附件下载（P0暂缓语音）
            ├─ Stage3: buildUserContent()  ← Emoji/mention解析
            ├─ Stage4: resolveQuote()  ← 引用解析
            ├─ Stage5: writeRefIndex()  ← 引用缓存写入
            ├─ Stage6: runGroupGateStage()  ← 群组门控（仅group）
            ├─ Stage7: buildBody/UserMessage/AgentBody  ← AI输入渲染
            └─ Stage8: buildDynamicCtx()  ← 元信息附加
                    │
                    ▼
            OpenClaw AI Dispatcher
                    │
                    ▼
            AI Response
                    │
                    ▼
            outbound-BJfhwrPg.js: sendText() / sendPhoto() / sendDocument()
                    │
                    ▼
            sender-p-B14eLG.js: ApiClient.request()
                    │
                    ▼
            QQ Open Platform REST API
```

---

## 三、消息流：出站

```
AI Response
    │
    ▼
outbound-BJfhwrPg.js
    │
    ├── sendText() → ApiClient.request(POST /v2/groups/{id}/messages)
    │                        └→ POST /v2/users/{id}/messages
    │
    ├── sendPhoto()
    │       ├── 本地: sendMedia() → 分块上传或 one-shot
    │       ├── URL: sendMedia() → urlDirectUpload
    │       └── Base64: one-shot upload (<20MB)
    │
    ├── sendVideo()  同上
    │
    └── sendDocument()  同上
            │
            ▼
        分块上传流程
            │
            ├─ POST /upload_prepare
            │   → { upload_id, block_size, COS_urls[] }
            │
            ├─ PUT COS_URL (每个 part)
            │
            ├─ POST /upload_part_finish (每个 part)
            │
            └─ POST /complete_upload
                → { file_uuid, file_info }
```

---

## 四、权限控制决策表

### DM (C2C) 策略

```
dmPolicy=open:
  allowFrom 包含 "*" → ✅ 允许
  sender 在 allowFrom 中 → ✅ 允许
  sender 不在 allowFrom 中 → ❌ 拒绝 (dm_policy_not_allowlisted)

dmPolicy=allowlist:
  allowFrom 为空 → ❌ 拒绝 (dm_policy_empty_allowlist)
  sender 在 allowFrom 中 → ✅ 允许
  sender 不在 allowFrom 中 → ❌ 拒绝 (dm_policy_not_allowlisted)

dmPolicy=disabled → ❌ 拒绝 (dm_policy_disabled)
```

### Group 策略

```
groupPolicy=open → ✅ 允许（默认）

groupPolicy=allowlist:
  groupAllowFrom/allowFrom 为空 → ❌ 拒绝 (group_policy_empty_allowlist)
  sender 在列表中 → ✅ 允许
  sender 不在列表中 → ❌ 拒绝 (group_policy_not_allowlisted)

groupPolicy=disabled → ❌ 拒绝 (group_policy_disabled)
```

---

## 五、群组 Gate 决策

```
输入:
  - requireMention (bool)
  - wasMentioned (bool, 来自 mentions.is_you 或 eventType)
  - hasAnyMention (bool, 有任何人 @)
  - implicitMention (bool, 引用了机器人的消息)
  - isControlCommand (bool, 以 / 开头)
  - commandAuthorized (bool, sender 在 allowFrom 中)
  - ignoreOtherMentions (bool)

决策:
1. ignoreOtherMentions && hasAnyMention && !wasMentioned && !implicitMention
   → drop_other_mention（丢弃，有其他人@但没@机器人）

2. allowTextCommands && isControlCommand && !commandAuthorized
   → block_unauthorized_command（未授权命令）

3. requireMention && !wasMentioned && !implicitMention && !commandAuthorized
   → skip_no_mention（未@，不响应但记录历史）

4. 否则 → pass（响应）
```

---

## 六、配置继承链

```
账号配置 (channels.qqbot.accounts[0]):
  allowFrom: ["qqbot:...", "*"]
  groupAllowFrom: ["..."]      ← 可选，默认用 allowFrom
  dmPolicy: "open"             ← open | allowlist | disabled
  groupPolicy: "allowlist"     ← open | allowlist | disabled
  groups:
    "*":
      requireMention: true
      ignoreOtherMentions: false
      toolPolicy: "restricted"
      name: ""
      historyLimit: 50
    "specific-group-id":
      requireMention: false     ← 覆盖 *
      name: "VIP群"

配置优先级: specific > * > 默认值
```

---

## 七、会话与缓存

```
Session 持久化:
  文件: ~/.openclaw/qqbot-data/sessions/session-{base64(accountId)}.json
  TTL: 300s
  内容: { sessionId, lastSeq, savedAt, appId }

Known Users:
  文件: ~/.openclaw/qqbot-data/data/known-users.json
  内容: { openid, type, nickname, firstSeenAt, lastSeenAt, interactionCount }

Ref Index (引用缓存):
  内存: Map<msgIdx, RefEntry>
  TTL: 300s (SESSION_EXPIRE_TIME)
  内容: { content, senderId, senderName, timestamp, attachments }

Group History:
  内存: Map<groupOpenid, HistoryEntry[]>
  限制: historyLimit (默认50)
```

---

## 八、API 端点映射

| 功能 | Method | Path |
|------|--------|------|
| 获取 Gateway URL | GET | `/gateway` |
| 获取 Access Token | POST | `/app/token` |
| 发送 C2C 消息 | POST | `/v2/users/{openid}/messages` |
| 发送群消息 | POST | `/v2/groups/{group_openid}/messages` |
| 发送频道消息 | POST | `/channels/{channel_id}/messages` |
| C2C 文件上传 | POST | `/v2/users/{openid}/files` |
| 群文件上传 | POST | `/v2/groups/{group_openid}/files` |
| 上传准备 | POST | `/v2/users/{openid}/upload_prepare` |
| 完成分块上传 | POST | `/v2/users/{openid}/upload_part_finish` |
| 完成上传 | POST | `/v2/users/{openid}/files` |
| 消息撤回 | DELETE | `/channels/{channel_id}/messages/{message_id}` |
| 表情反应 | POST | `/channels/{channel_id}/messages/{message_id}/reactions` |

---

## 九、关键数据类型

### QueuedMessage (队列消息)

```typescript
interface QueuedMessage {
  type: "c2c" | "dm" | "group" | "guild"
  senderId: string
  senderName?: string
  senderIsBot?: boolean
  content: string
  messageId: string
  timestamp: number
  // group 特有
  groupOpenid?: string
  // guild 特有
  channelId?: string
  guildId?: string
  // 附件
  attachments?: Attachment[]
  // 引用
  refMsgIdx?: string
  msgIdx?: string
  msgType?: number      // 103=引用消息
  msgElements?: any[]
  // group 特有
  eventType?: string    // "GROUP_AT_MESSAGE_CREATE" | "GROUP_MESSAGE_CREATE"
  mentions?: Mention[]
  messageScene?: any
  // 合并
  merge?: { count: number, messages: QueuedMessage[] }
}
```

### InboundContext (入站上下文)

```typescript
interface InboundContext {
  event: QueuedMessage
  route: AgentRoute
  isGroupChat: boolean
  peerId: string           // "group:xxx" | "dm:xxx" | "c2c:xxx"
  qualifiedTarget: string   // "qqbot:group:xxx" 等
  fromAddress: string
  parsedContent: string     // 原始内容（Emoji已解析）
  userContent: string       // 用户可见内容
  quotePart: string         // "[Quoted message begins]..."
  dynamicCtx: string       // 图片/语音元信息
  userMessage: string       // 最终发往 AI 的用户消息
  agentBody: string         // 含历史缓冲的完整内容
  body: string             // Web UI 渲染用
  systemPrompts: string[]
  groupSystemPrompt?: string
  attachments: ProcessedAttachments
  localMediaPaths: string[]
  localMediaTypes: string[]
  remoteMediaUrls: string[]
  remoteMediaTypes: string[]
  replyTo?: ReplyToInfo
  commandAuthorized: boolean
  group?: GroupInfo
  blocked: boolean
  skipped: boolean
}
```

---

## 十、OpenClaw 特有集成点

以下功能依赖 OpenClaw 框架，移植时需提供替代方案：

| 集成点 | 替代方案（独立插件） | 优先级 |
|--------|---------------------|--------|
| AI Dispatcher | 事件发射器 `on('message')` → 用户接管的 AI | P0 |
| Routing (Agent) | 提供原始消息，外部决定如何路由 | P0 |
| Session Store (框架) | 使用内置 JSON 文件存储 | P0 |
| History Port (框架) | 内置 Map 实现 | P0 |
| Approval Runtime | 内置按钮响应（需 web server） | P1 |
| STT | OpenAI Whisper API 调用 | P2 |
| Skill 系统 (channel/media/remind) | 独立 API 包装 | P2 |
| 配置 UI (onboard wizard) | 独立 web 配置页或 YAML | P1 |
| 内嵌交互 (INTERACTION_CREATE) | HTTP Server 接收回调 | P1 |

---

*文档版本: v1.0*
*分析基于 dist/ 目录的 bundle 文件*