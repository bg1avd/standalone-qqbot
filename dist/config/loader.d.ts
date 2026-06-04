/**
 * Configuration loader: supports YAML and JSON files.
 */
import type { QQBotConfig } from "../types/index.js";
export declare class ConfigLoadError extends Error {
    filePath?: string;
    constructor(message: string, filePath?: string, cause?: unknown);
}
/**
 * Load and validate config from file path (sync).
 */
export declare function loadConfig(filePath: string): QQBotConfig;
/**
 * Load config with default paths.
 */
export declare function loadConfigWithDefaults(dataDir?: string): QQBotConfig;
/**
 * Watch a config file for changes and reload automatically.
 */
export declare function watchConfig(filePath: string, onReload: (config: QQBotConfig) => void, onError: (err: Error) => void): () => void;
//# sourceMappingURL=loader.d.ts.map