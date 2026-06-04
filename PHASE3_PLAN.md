# Phase 3 开发计划

**目标**: 完成 Phase 2 延后功能，完善生产就绪
**日期**: 2026-06-04
**状态**: 规划中

---

## 🎯 Phase 3 范围

| Phase | 功能 | 优先级 | 说明 | 预计工时 |
|-------|------|--------|------|---------|
| 3.1 | 语音发送 (sendVoice) | P2 | SILK 编码 + 上传 | 2 天 |
| 3.2 | Web 配置 UI | P3 | 可视化配置界面 | 3 天 |
| 3.3 | 扫码授权 | P3 | @tencent-connect/qqbot-connector 集成 | 2 天 |
| **Phase 3 总计** | | | | **7 个工作日** |

---

## 📋 详细任务拆解

### 3.1 语音发送 (sendVoice)

**现状**: 已支持接收语音并解码，但无法发送语音消息

**实现方案**:
```
1. 集成 silk-wasm encode()
2. sendVoice(ctx, audioPath, { format: 'silk' | 'pcm' })
3. 自动编码 + 上传 (复用 ChunkedUploader)
4. 发送 media reference (类似图片/视频)
```

**依赖**:
- silk-wasm (已有 decode，需添加 encode 接口)

**文件修改**:
- ✨ `src/outbound/voice-sender.ts` - 语音发送逻辑
- ✅ `src/outbound/media-sender.ts` - 集成 `sendVoice()`
- ⚠️ `src/types/silk-wasm.d.ts` - 补充 encode 类型声明

**测试用例**:
- [ ] 发送 .wav → 自动转 silk → 上传引用
- [ ] 发送 .silk → 直接上传
- [ ] 大语音文件 (>20MB) 触发分块上传

---

### 3.2 Web 配置 UI

**问题**: 目前配置只能通过 YAML 文件编辑，不友好

**实现方案**:
```
1. 轻量 HTTP Server (koa/express/hono)
2. GET /config → 显示当前配置表单
3. POST /config → 保存并热重载
4. 静态文件服务 (HTML/CSS/JS)
5. 认证 (basic auth 或 token)
```

**技术选型**: 待定（考虑零依赖，用原生 fetch + 简单路由）

**文件结构**:
```
src/web/
├── server.ts      - HTTP server
├── routes.ts      - 路由配置
├── ui/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── config/
    └── api.ts     - 读写 config store
```

**安全问题**:
- 必须绑定到 localhost 或需要 auth
- 不暴露 appId/clientSecret 到前端

---

### 3.3 扫码授权

**目标**: 提供类似 OpenClaw 的 `qqbot-unified-auth` 扫码登录流程

**集成**: @tencent-connect/qqbot-connector (或类似 npm 包)

**流程**:
```
1. 生成授权二维码 (App ID + redirect URI)
2. 用户扫码授权 (QQ 账号)
3. 获取 access_token + openid
4. 自动填充到配置文件
```

**文件结构**:
```
src/auth/
├──qr.ts       - 二维码生成
├──callback.ts - OAuth callback 处理
└──connector.ts - 统一授权接口
```

---

## 🔄 开发顺序

1. **Day 1-2**: 语音发送 (3.1)
   - 封装 `VoiceSender` 类
   - 集成到 `media-sender.ts`
   - 测试完整语音发送链路

2. **Day 3-5**: Web 配置 UI (3.2)
   - 搭建 HTTP server
   - 实现配置读写 API
   - 开发前端界面
   - 认证与安全加固

3. **Day 6-7**: 扫码授权 (3.3)
   - 集成第三方授权库
   - 实现 QR 生成与轮询
   - 回调处理
   - 文档与示例

---

## 📦 新增依赖

| 功能 | 依赖 | 类型 |
|------|------|------|
| 语音发送 | silk-wasm (encode) | required |
| Web UI | koa/express (可选) | optional |
| 扫码授权 | @tencent-connect/qqbot-connector | optional |

---

## 🧪 测试策略

### 单元测试
- `VoiceSender.encodeSILK()` 已知样本
- `ChunkedUploader` 大文件流程

### 集成测试
- 语音发送完整链路（本地 .wav → QQ 群）
- Web UI 配置保存与热重载

### 手动验证
- QQ 群组语音消息播放
- 扫码授权流程

---

## 📝 交付物

### 代码变更

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/outbound/voice-sender.ts` | 新建 | 语音发送器 |
| `src/web/server.ts` | 新建 | HTTP server |
| `src/web/ui/*` | 新建 | 前端界面 |
| `src/auth/*` | 新建 | 扫码授权 |

### 文档更新

- [ ] `SPEC.md` - 更新实现状态
- [ ] `STATUS.md` - 标记 Phase 3 完成
- [ ] `README.md` - 新增 Web UI 使用说明、授权流程
- [ ] `CHANGELOG.md` - 记录 v0.3.0 改动

---

## ⚠️ 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| silk-wasm encode 质量不佳 | 语音发送失真 | 对比 QQ 官方编码标准 |
| Web UI 安全漏洞 | 配置泄露 | localhost 绑定 + basic auth |
| 扫码授权库不稳定 | 流程失败 | 多方案备选，回退到手动配置 |

---

## ✅ 成功标准

- [ ] 语音消息可发送且 QQ 可播放
- [ ] Web UI 可修改配置并实时生效
- [ ] 扫码授权能完成 AppID/Secret 自动填充
- [ ] 所有单元测试通过
- [ ] 无高危安全漏洞

---

**Phase 2 已完成**: v0.2.0 已发布 ✅\n**Phase 3 启动**: 准备就绪 🚀
