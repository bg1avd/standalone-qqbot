/**
 * Built-in Commands — 内置命令实现
 *
 * 实现基础命令：
 * - /stop — 紧急停止
 * - /help — 帮助信息
 * - /status — 状态查询
 * - /reset — 重置会话
 * - /clear — 清除历史
 * - /ping — 检查连接
 */

import type { CommandContext, SlashCommand } from "../types/index.js"
import { getHelpText } from "./parser.js"
import { log } from "../utils/logger.js"

/**
 * 内置命令处理函数
 */
export const builtinCommands: SlashCommand[] = [
  {
    name: "stop",
    description: "紧急停止（跳过队列立即执行）",
    requireAuth: false,
    handler: async (ctx) => {
      log.command.info(`/stop received from ${ctx.senderId}`)
      return {
        text: "🛑 已停止当前任务队列",
      }
    },
  },
  {
    name: "s",
    description: "/stop 的别名",
    requireAuth: false,
    handler: async (ctx) => {
      return builtinCommands[0].handler(ctx)
    },
  },
  {
    name: "help",
    description: "显示帮助信息",
    requireAuth: false,
    handler: async () => {
      return getHelpText()
    },
  },
  {
    name: "h",
    description: "/help 的别名",
    requireAuth: false,
    handler: async (ctx) => {
      return builtinCommands.find((c) => c.name === "help")?.handler(ctx) ?? ""
    },
  },
  {
    name: "status",
    description: "查看机器人状态",
    requireAuth: false,
    handler: async (ctx) => {
      const uptime = Math.round((Date.now() - ctx.receivedAt) / 1000)
      return `📊 状态：
· AppID: ${ctx.appId.slice(0, 5)}***${ctx.appId.slice(-3)}
· 运行时间：${formatUptime(uptime)}
· 连接：正常`
    },
  },
  {
    name: "reset",
    description: "重置当前会话",
    requireAuth: true,
    handler: async (ctx) => {
      log.command.info(`/reset received from ${ctx.senderId} (authorized=${ctx.commandAuthorized})`)
      return {
        text: "🔄 会话已重置",
      }
    },
  },
  {
    name: "clear",
    description: "清除历史缓冲",
    requireAuth: true,
    handler: async (ctx) => {
      log.command.info(`/clear received from ${ctx.senderId}`)
      return {
        text: "🧹 历史缓冲已清除",
      }
    },
  },
  {
    name: "ping",
    description: "检查连接状态",
    requireAuth: false,
    handler: async () => {
      return "🏓 Pong! 连接正常"
    },
  },
]

/**
 * 根据名称查找命令
 */
export function findCommand(name: string): SlashCommand | undefined {
  return builtinCommands.find((c) => c.name === name.toLowerCase() || name.toLowerCase() === c.name)
}

/**
 * 注册自定义命令
 */
export function registerCommand(commands: SlashCommand[], command: SlashCommand): void {
  // 检查是否已存在
  const existing = commands.findIndex((c) => c.name === command.name)
  if (existing !== -1) {
    log.command.warn(`Command "${command.name}" already registered, replacing`)
    commands[existing] = command
  } else {
    commands.push(command)
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}