/**
 * Slash Command Parser — 斜杠命令解析
 *
 * 识别并解析斜杠命令：
 * - `/stop` — 紧急停止（跳过队列立即执行）
 * - `/help` — 帮助信息
 * - `/status` — 状态查询
 * - `/reset` — 重置会话
 *
 * 参考：OpenClaw QQBot 的 slash-command-handler
 */

import { log } from "../utils/logger.js"

export interface ParsedCommand {
  name: string
  args: string
  isUrgent: boolean
}

const URGENT_COMMANDS = new Set(["stop", "s"])

const BUILTIN_COMMANDS = new Set([
  "stop",
  "s",
  "help",
  "h",
  "status",
  "reset",
  "clear",
  "ping",
])

/**
 * 解析斜杠命令
 *
 * @param content - 原始消息内容
 * @returns 解析结果（非命令返回 null）
 */
export function parseSlashCommand(content: string): ParsedCommand | null {
  const trimmed = content.trim()

  // 检查是否以 / 开头
  if (!trimmed.startsWith("/")) {
    return null
  }

  // 解析命令名和参数
  const parts = trimmed.slice(1).split(/\s+/)
  const name = parts[0]?.toLowerCase() ?? ""
  const args = parts.slice(1).join(" ").trim()

  if (!name) {
    return null
  }

  const isUrgent = URGENT_COMMANDS.has(name)

  log.command.debug?.(`Parsed command: /${name} args="${args}" urgent=${isUrgent}`)

  return {
    name,
    args,
    isUrgent,
  }
}

/**
 * 检查是否为有效的内置命令
 */
export function isBuiltinCommand(name: string): boolean {
  return BUILTIN_COMMANDS.has(name.toLowerCase())
}

/**
 * 检查是否为紧急命令（需要跳过队列立即执行）
 */
export function isUrgentCommand(name: string): boolean {
  return URGENT_COMMANDS.has(name.toLowerCase())
}

/**
 * 获取所有内置命令列表
 */
export function getBuiltinCommands(): string[] {
  return Array.from(BUILTIN_COMMANDS)
}

/**
 * 生成帮助文本
 */
export function getHelpText(): string {
  return `可用命令：
  /stop, /s      — 紧急停止（跳过队列立即执行）
  /help, /h      — 显示此帮助信息
  /status        — 查看机器人状态
  /reset         — 重置当前会话
  /clear         — 清除历史缓冲
  /ping          — 检查连接状态`
}