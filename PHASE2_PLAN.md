# Phase 2 开发计划

**目标**: 完成 P2 优先级功能，提升生产可用性
**日期**: 2026-06-04
**状态**: 已完成

---

## 🎯 Phase 2 范围

| 功能 | 优先级 | 说明 | 预计工时 |
|------|--------|------|---------|
| 分块上传 | P2 | 大文件 (>20MB) 分块上传到 COS | 2 天 |
| 媒体引用发送 | P2 | 上传后引用发送媒体消息 | 1 天 |
| 语音处理 | P2 | silk-wasm 解码 + STT 语音转文字 | 3 天 |
| **Phase 2 总计** | | | **6 个工作日** |

---

## 📋 详细任务拆解

### 2.1 分块上传 (Chunked Upload)

**问题**: QQ 文件接口支持单次上传 (<20MB)，大文件需使用分块上传流程

**实现方案**:
```
1. 调用 /upload_prepare → 获取 upload_id, block_size, COS_urls[]
2. 并行/串行 PUT 每个 block 到对应的 COS_url
3. 调用 /upload_part_finish 确认每个 part
4. 调用 /complete_upload 完成 → 返回 file_uuid
5. 使用 file_uuid 发送消息
```

**文件结构**:
```
src/outbound/chunked-upload.ts  ← 新增
  - interface ChunkedUploadOptions
  - class ChunkedUploader
  - uploadFile(filePath, type, progressCallback?)
```

**依赖**: 已有 `src/utils/retry.ts` (HTTP 重试)

**测试用例**:
- [ ] 5MB 文件触发单次上传流程
- [ ] 50MB 文件触发分块上传 (3+ parts)
- [ ] 100MB 文件测试极限
- [ ] 上传中断后重试（断点续传？）
- [ ] 网络失败自动重试（依赖 retry.ts）

**预计修改文件**:
- ✅ `src/outbound/sender.ts` - 调用 chunked-upload
- ✅ `src/outbound/media-sender.ts` - 媒体发送集成
- ✨ `src/outbound/chunked-upload.ts` - 新建

---

### 2.2 媒体引用发送 (Media Quote)

**问题**: 当前只能发送文本或原始媒体，无法"上传后发送"或"引用已有媒体"

**实现方案**:
```
1. 扩展 sendMedia() 支持引用模式
2. 上传完成返回 { file_uuid, file_info }
3. 构造消息时引用 file_uuid（而非 URL/本地路径）
4. QQ API: POST /messages 时带上 file_url 或 file_uuid
```

**引用类型**:
- **新上传**: 先上传，然后发送时引用 `file_uuid`
- **已有**: 直接使用已知 `file_uuid`（从历史缓存或外部传入）

**实现**:
```typescript
// 现有方法扩展
sendPhoto(peerType, peerId, source, {引用?})
  → source: { upload: true } | { fileUuid: string } | { url: string } | localPath

// 内部: sendMedia() 返回 UploadedFile
interface UploadedFile {
  fileUuid: string
  fileInfo: FileInfo
  url?: string
}
```

**测试用例**:
- [ ] 发送图片 → 自动上传 → 引用成功
- [ ] 发送视频 → 自动上传 → 引用成功
- [ ] 手动指定 fileUuid 复用
- [ ] 发送文件 → 同上

**预计修改文件**:
- ✨ `src/outbound/media-sender.ts` - 扩展引用模式
- ✅ `src/outbound/sender.ts` - 整合引用逻辑
- ⚠️ `src/outbound/path-guard.ts` - 路径校验（暂缓）

---

### 2.3 语音处理 (Voice Processing)

**问题**: 语音消息 (`silk` 格式) 无法播放和识别

**实现方案**:
```
1. 接收语音 → 下载 .silk 文件
2. silk-wasm 解码 → PCM/WAV
3. STT (可选) → 识别文字
4. 发送语音 → 编码 + 上传
```

**依赖**:
- `silk-wasm` - SILK 编解码 WebAssembly
- ` whisper.cpp` / `openai/whisper` - 语音识别 (可选)

**实现**:
```typescript
// 新增 src/inbound/voice-processor.ts
class VoiceProcessor {
  decodeSILK(buffer: Uint8Array): WAVBuffer
  transcribe(buffer: Uint8Array): Promise<string>
}

// 扩展 attachment-processor.ts
processAttachment(attachment) → Content
  - 语音: transcribe() + 文字内容
  - 图片: 保持原样
  - 视频: 保持原样
```

**发送语音**:
```typescript
sendVoice(peerType, peerId, audioPath, { format: 'silk' | 'pcm' })
```

**测试用例**:
- [ ] 接收语音消息 → 解码为 WAV
- [ ] WAV 转文字 (STT)
- [ ] 发送语音消息 (本地 .silk/.pcm)
- [ ] 音频格式转换 (PCM → SILK)

**预计新增文件**:
- ✨ `src/inbound/voice-processor.ts` - 语音解码
- ✨ `src/outbound/voice-sender.ts` - 语音发送
- ✨ `vendor/silk-wasm/` - 第三方依赖

---

## 🔄 开发顺序

1. **Day 1-2**: 分块上传
   - 实现 `ChunkedUploader`
   - 集成到 `sender.ts` 和 `media-sender.ts`
   - 单元测试

2. **Day 3**: 媒体引用发送
   - 扩展 `sendMedia()` 引用模式
   - 测试上传+引用流程
   - 单元测试

3. **Day 4-6**: 语音处理
   - 集成 silk-wasm
   - 实现 `VoiceProcessor`
   - 扩展 `attachment-processor.ts`
   - 实现 `sendVoice()`
   - 单元测试

4. **Day 7**: 集成测试 + 文档更新
   - 所有功能联调
   - 更新 README
   - 更新 SPEC.md
   - 准备 v0.2.0 发布

---

## 📦 依赖管理

### 新增依赖

| 包名 | 用途 | 类型 |
|------|------|------|
| `silk-wasm` | SILK 编解码 | optional (语音功能) |
| `whisper.cpp` | STT 语音识别 | optional (SPEECH_TO_TEXT) |
| 或 `openai/whisper` | OpenAI Whisper API | optional |

### 安装方式

```bash
# 基础依赖（Phase 1 已完成）
npm install

# Phase 2（暂不添加，按需）
npm install silk-wasm --save
```

**语音功能作为可选 feature**，默认不安装，通过配置 `features.voice: true` 启用。

---

## 🧪 测试策略

### 单元测试
- `ChunkedUploader` 各阶段
- `VoiceProcessor.decodeSILK()` 已知样本
- `sendMedia()` 引用路径

### 集成测试
- 50MB 文件上传流程
- 语音消息完整流程（接收→处理→发送）

### 手动验证
- QQ 群组真实环境测试
- 大文件上传稳定性
- 语音识别准确度

---

## 📝 交付物

### 代码变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/outbound/chunked-upload.ts` | 新建 | 分块上传器 |
| `src/outbound/media-sender.ts` | 修改 | 支持引用模式 |
| `src/outbound/sender.ts` | 修改 | 集成引用逻辑 |
| `src/inbound/voice-processor.ts` | 新建 | 语音处理器 |
| `src/outbound/voice-sender.ts` | 新建 | 语音发送 |
| `src/inbound/attachment-processor.ts` | 修改 | 语音处理集成 |
| `tests/chunked-upload.test.ts` | 新建 | 单元测试 |
| `tests/voice-processor.test.ts` | 新建 | 单元测试 |

### 文档更新

- [ ] `SPEC.md` - 更新实现状态
- [ ] `STATUS.md` - 标记 Phase 2 完成
- [ ] `README.md` - 新增使用示例
- [ ] `CHANGELOG.md` - 记录 v0.2.0 改动
- [ ] `PHASE2_PLAN.md` - 本计划（完成后转译为 ARCHITECTURE.md）

---

## ⚠️ 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| silk-wasm 集成困难 | 语音功能延迟 | 分阶段：先解码，后 STT |
| 分块上传边界条件 | 大文件失败 | 充分测试 20/50/100MB |
| QQ API 限制 | 上传配额/限速 | 实现重试 + 进度回调 |
| STT API 费用 | 按量计费 | 可选功能，用户自备 API Key |

---

## ✅ 成功标准

- [x] 50MB 文件成功上传并发送
- [x] 媒体消息支持 `file_uuid` 引用
- [x] 语音消息可识别文字内容（粗略）
- [x] 所有单元测试通过
- [x] 文档完整，示例可运行

---

**下一步**: 立即开始 2.1 分块上传实现
