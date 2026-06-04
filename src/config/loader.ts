/**
 * Configuration loader: supports YAML and JSON files.
 */

import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { z } from "zod"
import YAML from "yaml"
import { QQBotConfigSchema } from "./schema.js"
import type { QQBotConfig, QQBotAccountConfig } from "../types/index.js"
import { log } from "../utils/logger.js"

export class ConfigLoadError extends Error {
  filePath?: string
  constructor(
    message: string,
    filePath?: string,
    cause?: unknown
  ) {
    super(message)
    this.name = "ConfigLoadError"
    this.filePath = filePath
    this.cause = cause
  }
}

/**
 * Detect file format from extension.
 */
function detectFormat(filePath: string): "yaml" | "json" {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase()
  if (ext === ".json") return "json"
  return "yaml"
}

/**
 * Resolve client secret from inline value or file path.
 */
function resolveClientSecret(config: any): any {
  if (config.clientSecretFile) {
    try {
      const secret = readFileSync(config.clientSecretFile, "utf-8").trim()
      return { ...config, clientSecret: secret }
    } catch (err) {
      throw new ConfigLoadError(
        `Failed to read clientSecretFile: ${config.clientSecretFile}`,
        config.clientSecretFile,
        err
      )
    }
  }
  if (!config.clientSecret) {
    throw new ConfigLoadError(`Account ${config.appId} has neither clientSecret nor clientSecretFile`)
  }
  return config
}

/**
 * Load and validate config from file path (sync).
 */
export function loadConfig(filePath: string): QQBotConfig {
  log.config("Loading config from: %s", filePath)

  let content: string
  try {
    content = readFileSync(filePath, "utf-8")
  } catch (err) {
    throw new ConfigLoadError(`Failed to read config file: ${filePath}`, filePath, err)
  }

  const format = detectFormat(filePath)
  let raw: unknown

  try {
    if (format === "json") {
      raw = JSON.parse(content)
    } else {
      raw = YAML.parse(content)
    }
  } catch (err) {
    throw new ConfigLoadError(
      `Failed to parse config (${format}): ${err instanceof Error ? err.message : String(err)}`,
      filePath,
      err
    )
  }

  const rawAny = raw as any
  const accounts = Array.isArray(rawAny.accounts)
    ? rawAny.accounts.map(resolveClientSecret)
    : [resolveClientSecret(rawAny)]

  const rawConfig = { accounts }
  const result = QQBotConfigSchema.safeParse(rawConfig)

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new ConfigLoadError(`Config validation failed:\n${issues}`, filePath)
  }

  log.config("Config loaded successfully: %d account(s)", result.data.accounts.length)
  return result.data as unknown as QQBotConfig
}

/**
 * Load config with default paths.
 */
export function loadConfigWithDefaults(dataDir?: string): QQBotConfig {
  const defaults = [
    "qqbot.yaml",
    "qqbot.config.yaml",
    "qqbot.json",
    "qqbot.config.json",
  ]

  // Try current directory first
  for (const name of defaults) {
    try {
      return loadConfig(name)
    } catch (err) {
      if ((err as ConfigLoadError).filePath) {
        // File existed but failed to load
        throw err
      }
      // File not found, try next
    }
  }

  // Try data directory
  if (dataDir) {
    for (const name of defaults) {
      const path = join(dataDir, name)
      try {
        return loadConfig(path)
      } catch {
        // Not found
      }
    }
  }

  // Try home directory
  const homeConfig = join(homedir(), ".standalone-qqbot", "config.yaml")
  try {
    return loadConfig(homeConfig)
  } catch {
    // Not found
  }

  throw new ConfigLoadError(
    `No config file found. Searched:\n` +
    defaults.map((n) => `  - ./${n}\n`).join("") +
    `  - ${homeConfig}`
  )
}

/**
 * Watch a config file for changes and reload automatically.
 */
export function watchConfig(
  filePath: string,
  onReload: (config: QQBotConfig) => void,
  onError: (err: Error) => void
): () => void {
  const { watch } = require("fs")
  const { statSync } = require("fs")

  let lastMtime = 0
  let watcher: any = null

  try {
    const initialStat = statSync(filePath)
    lastMtime = initialStat.mtimeMs
  } catch {
    // File doesn't exist yet
  }

  const handleChange = () => {
    try {
      const { mtimeMs } = statSync(filePath)
      if (mtimeMs !== lastMtime) {
        lastMtime = mtimeMs
        const config = loadConfig(filePath)
        log.config("Config file changed, reloaded")
        onReload(config)
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  watcher = watch(filePath, handleChange)

  return () => {
    if (watcher) {
      watcher.close()
    }
  }
}