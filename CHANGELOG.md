# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.3.0] - 2026-06-04

### Added
- **Phase 2: Complete大文件与语音处理**
  - Chunked Upload (P2.1): 大文件 (>20MB) 分块上传支持
  - Media Reference (P2.2): 上传后引用媒体消息发送
  - Voice Processing (P2.3): 接收语音解码 + 可选 STT 转文字
- **Phase 3.1: Voice Sending**
  - `sendVoice()` API for audio files (.wav, .pcm, .silk)
  - WAV/PCM to SILK encoding via silk-wasm
  - One-shot and chunked upload support
- **Phase 3.2: Web Config UI**
  - Native HTTP server (zero dependencies)
  - Config editor with YAML/JSON editing
  - Optional Basic Auth and CORS control
  - Integrated into QQBotClient via `webConfig` option
- Extended silk-wasm type declarations
- Added `voice` logger namespace

### Changed
- Media sending unified under `sendMedia*` family
- TypeScript types enriched across inbound/outbound modules
- STATUS.md and SPEC.md fully updated

### Fixed
- Various small bug fixes and stability improvements

### Security
- Web UI bound to localhost by default (127.0.0.1)

---

## [0.2.0] - 2026-06-04

### Added
- **Phase 2.1: Chunked Upload**
- **Phase 2.2: Media Reference Sending**
  - Added `chunked` logger namespace
  - Added `PHASE2_PLAN.md`

### Changed
- Large file auto-chunking
- `sendMedia*()` return `messageId`
- Type improvements

### Security
- N/A

---

## [0.1.0] - 2026-06-03

### Added
- Initial release
- Gateway 连接 & 重连
- 8-stage inbound pipeline
- Group management
- Outbound text & media (one-shot)
- Slash command system
- Config hot-reload
- Multi-account support

## [0.1.0] - 2026-06-03

### Added
- Initial release of standalone-qqbot
- WebSocket Gateway connection with auto-reconnect
- Inbound message processing pipeline (8-stage)
- Group management (history buffering, merging, mention detection)
- Outbound text and media sending (one-shot only for <20MB)
- Slash command system with built-in commands
- Configuration system with YAML/JSON support and hot-reload
- Multi-account support
- Complete TypeScript type definitions
- Comprehensive documentation (README, SPEC, STATUS)

**Status**: Phase 1 complete (100%)

---

## [0.2.0] - 2026-06-04

### Added
- **Phase 2.1: Chunked Upload** - Support for large file uploads (>20MB) via block-based streaming
  - `ChunkedUploader` class for efficient multi-block uploads
  - Concurrent upload control (default 3 workers)
  - Progress callback support for real-time feedback
- **Phase 2.2: Media Reference Sending** - Ability to send messages with media references after upload
  - Extended `sendPhoto()`, `sendVideo()`, `sendDocument()` to automatically handle large files via chunked upload
  - `sendMediaReference()` for inserting uploaded media into messages
- **Phase 2.3: Voice Processing (Receive)** - Voice message support
  - `VoiceProcessor` class with `silk-wasm` integration for SILK decoding
  - Automatic voice download and decode pipeline
  - Optional STT via OpenAI Whisper API
  - Extended `ProcessedAttachments` with `voiceDecodedWavPaths`
  - Environment-based config: `VOICE_ENABLE_PROCESSING`, `VOICE_STT_API_KEY`
- Added `voice` logger namespace for voice diagnostics
- Added `PHASE2_PLAN.md` for development roadmap
- Added `src/types/silk-wasm.d.ts` for TypeScript declarations

### Changed
- Media sending flow: large files (>20MB) now automatically use chunked upload instead of failing
- `sendMedia*()` return type includes `messageId` when successful
- TypeScript type improvements across inbound and outbound modules
- Updated `STATUS.md` and `SPEC.md` to track Phase 2 progress

### Fixed
- N/A (initial release after Phase 1)

### Security
- N/A (no security issues identified)

---

## [0.1.0] - 2026-06-03

### Added
- Initial release of standalone-qqbot
- WebSocket Gateway connection with auto-reconnect
- Inbound message processing pipeline (8-stage)
- Group management (history buffering, merging, mention detection)
- Outbound text and media sending (one-shot only for <20MB)
- Slash command system with built-in commands
- Configuration system with YAML/JSON support and hot-reload
- Multi-account support
- Complete TypeScript type definitions
- Comprehensive documentation (README, SPEC, STATUS)

**Status**: Phase 1 complete (100%)

---

## [0.3.0] - 2026-06-04

### Added
- **Phase 3.1: Voice Sending**
  - `sendVoice()` API for audio files (.wav, .pcm, .silk)
  - WAV/PCM to SILK encoding via silk-wasm
  - One-shot and chunked upload support
  - Integrated with media-sender
- Extended silk-wasm type declarations

### Changed
- N/A

### Fixed
- N/A

### Security
- N/A

---

## [0.2.0] - 2026-06-04

### Added
- **Phase 2.1: Chunked Upload** - Support for large file uploads (>20MB) via block-based streaming
  - `ChunkedUploader` class for efficient multi-block uploads
  - Concurrent upload control (default 3 workers)
  - Progress callback support for real-time feedback
- **Phase 2.2: Media Reference Sending** - Ability to send messages with media references after upload
  - Extended `sendPhoto()`, `sendVideo()`, `sendDocument()` to automatically handle large files via chunked upload
  - `sendMediaReference()` for inserting uploaded media into messages
- **Phase 2.3: Voice Processing (Receive)** - Voice message support
  - `VoiceProcessor` class with silk-wasm decoding
  - Automatic voice download and decode pipeline
  - Optional STT via OpenAI Whisper API
  - Extended `ProcessedAttachments` with `voiceDecodedWavPaths`
  - Environment-based config: `VOICE_ENABLE_PROCESSING`, `VOICE_STT_API_KEY`
- Added `voice` logger namespace for voice diagnostics
- Added `PHASE2_PLAN.md` for development roadmap
- Added `src/types/silk-wasm.d.ts` for TypeScript declarations

### Changed
- Media sending flow: large files (>20MB) now automatically use chunked upload instead of failing
- `sendMedia*()` return type includes `messageId` when successful
- TypeScript type improvements across inbound and outbound modules
- Updated `STATUS.md` and `SPEC.md` to track Phase 2 progress

### Fixed
- N/A (initial release after Phase 1)

### Security
- N/A (no security issues identified)

---

## [0.1.0] - 2026-06-03

### Added
- Initial release of standalone-qqbot
- WebSocket Gateway connection with auto-reconnect
- Inbound message processing pipeline (8-stage)
- Group management (history buffering, merging, mention detection)
- Outbound text and media sending (one-shot only for <20MB)
- Slash command system with built-in commands
- Configuration system with YAML/JSON support and hot-reload
- Multi-account support
- Complete TypeScript type definitions
- Comprehensive documentation (README, SPEC, STATUS)

**Status**: Phase 1 complete (100%)

---

## Upcoming (Phase 3)

- Web 配置 UI
- 扫码授权集成
