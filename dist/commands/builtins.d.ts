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
import type { SlashCommand } from "../types/index.js";
/**
 * 内置命令处理函数
 */
export declare const builtinCommands: SlashCommand[];
/**
 * 根据名称查找命令
 */
export declare function findCommand(name: string): SlashCommand | undefined;
/**
 * 注册自定义命令
 */
export declare function registerCommand(commands: SlashCommand[], command: SlashCommand): void;
//# sourceMappingURL=builtins.d.ts.map