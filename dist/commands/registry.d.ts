/**
 * Command Registry — 命令注册表
 *
 * 管理所有注册的命令（内置 + 自定义），提供执行入口。
 */
import type { SlashCommand, CommandContext } from "../types/index.js";
/**
 * 命令注册表
 */
export declare class CommandRegistry {
    private commands;
    private enabled;
    /**
     * 注册自定义命令
     */
    register(command: SlashCommand): void;
    /**
     * 查找命令
     */
    find(name: string): SlashCommand | undefined;
    /**
     * 执行命令
     */
    execute(ctx: CommandContext): Promise<string | {
        text: string;
        filePath?: string;
    } | null>;
    /**
     * 启用/禁用命令系统
     */
    setEnabled(enabled: boolean): void;
    /**
     * 获取所有已注册命令
     */
    listCommands(): SlashCommand[];
    /**
     * 清除所有自定义命令（保留内置）
     */
    clearCustom(): void;
}
/**
 * 创建命令注册表实例
 */
export declare function createCommandRegistry(): CommandRegistry;
//# sourceMappingURL=registry.d.ts.map