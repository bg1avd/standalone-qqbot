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
export interface ParsedCommand {
    name: string;
    args: string;
    isUrgent: boolean;
}
/**
 * 解析斜杠命令
 *
 * @param content - 原始消息内容
 * @returns 解析结果（非命令返回 null）
 */
export declare function parseSlashCommand(content: string): ParsedCommand | null;
/**
 * 检查是否为有效的内置命令
 */
export declare function isBuiltinCommand(name: string): boolean;
/**
 * 检查是否为紧急命令（需要跳过队列立即执行）
 */
export declare function isUrgentCommand(name: string): boolean;
/**
 * 获取所有内置命令列表
 */
export declare function getBuiltinCommands(): string[];
/**
 * 生成帮助文本
 */
export declare function getHelpText(): string;
//# sourceMappingURL=parser.d.ts.map