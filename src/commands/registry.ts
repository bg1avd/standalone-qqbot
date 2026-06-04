/**
 * Command Registry — 命令注册表
 *
 * 管理所有注册的命令（内置 + 自定义），提供执行入口。
 */

import type { SlashCommand, CommandContext } from "../types/index.js"
import { builtinCommands, findCommand } from "./builtins.js"
import { log } from "../utils/logger.js"

/**
 * 命令注册表
 */
export class CommandRegistry {
  private commands: SlashCommand[] = [...builtinCommands]
  private enabled = true

  /**
   * 注册自定义命令
   */
  register(command: SlashCommand): void {
    const existing = this.commands.findIndex((c) => c.name === command.name)
    if (existing !== -1) {
      log.command.warn(`Command "${command.name}" already registered, replacing`)
      this.commands[existing] = command
    } else {
      this.commands.push(command)
      log.command.info(`Command registered: ${command.name}`)
    }
  }

  /**
   * 查找命令
   */
  find(name: string): SlashCommand | undefined {
    return findCommand(name) ?? this.commands.find((c) => c.name === name.toLowerCase())
  }

  /**
   * 执行命令
   */
  async execute(ctx: CommandContext): Promise<string | { text: string; filePath?: string } | null> {
    if (!this.enabled) {
      log.command.debug(`Commands disabled, ignoring /${ctx.args}`)
      return null
    }

    const cmd = this.find(ctx.args)
    if (!cmd) {
      log.command.debug(`Unknown command: /${ctx.args}`)
      return `❓ 未知命令：/${ctx.args}\n\n使用 /help 查看可用命令`
    }

    // 授权检查
    if (cmd.requireAuth && !ctx.commandAuthorized) {
      log.command.warn(`Unauthorized command /${cmd.name} from ${ctx.senderId}`)
      return `❌ 权限不足：/${cmd.name} 需要管理员权限`
    }

    try {
      log.command.debug(`Executing /${cmd.name}`)
      const result = await cmd.handler(ctx)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.command.error(`Command /${cmd.name} failed: ${msg}`)
      return `❌ 命令执行失败：${msg}`
    }
  }

  /**
   * 启用/禁用命令系统
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    log.command.info(`Commands ${enabled ? "enabled" : "disabled"}`)
  }

  /**
   * 获取所有已注册命令
   */
  listCommands(): SlashCommand[] {
    return [...this.commands]
  }

  /**
   * 清除所有自定义命令（保留内置）
   */
  clearCustom(): void {
    this.commands = [...builtinCommands]
    log.command.info(`Custom commands cleared`)
  }
}

/**
 * 创建命令注册表实例
 */
export function createCommandRegistry(): CommandRegistry {
  return new CommandRegistry()
}