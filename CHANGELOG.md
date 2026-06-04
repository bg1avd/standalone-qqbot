# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.0] - 2026-06-04

### Added
- **Phase 2.1: Chunked Upload** - Support for large file uploads (>20MB) via block-based streaming
  - `ChunkedUploader` class for efficient multi-block uploads
  - Concurrent upload control (default 3 workers)
  - Progress callback support for real-time feedback
- **Phase 2.2: Media Reference Sending** - Ability to send messages with media references after upload
  - Extended `sendPhoto()`, `sendVideo()`, `sendDocument()` to automatically handle large files via chunked upload
  - `sendMediaReference()` for inserting uploaded media into messages
- Added `chunked` logger namespace for upload diagnostics
- Added `PHASE2_PLAN.md` for development roadmap

### Changed
- Media sending flow: large files (>20MB) now automatically use chunked upload instead of failing
- `sendMedia*()` return type includes `messageId` when successful
- TypeScript type improvements across outbound modules
- Updated `STATUS.md` to track Phase 2 progress

### Fixed
- N/A (initial release after Phase 1)

### Security
- N/A (no security issues identified)

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

## Upcoming (Phase 2.3)

- Voice processing (silk-wasm decoding)
- STT integration for voice messages
- `sendVoice()` method for audio sending
