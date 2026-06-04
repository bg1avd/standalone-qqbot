/**
 * Minimal debug-based logger with namespace support.
 * Enabled via DEBUG env var: DEBUG=qqbot:* or DEBUG=qqbot:gateway,qqbot:api
 */

import debugLib from "debug"

/**
 * Logger interface - extends debug.Debugger with convenience methods
 */
export interface Logger {
  (format: string, ...args: any[]): void
  enabled: boolean
  namespace: string
  // Convenience methods (aliased to main call)
  debug(format: string, ...args: any[]): void
  info(format: string, ...args: any[]): void
  warn(format: string, ...args: any[]): void
  error(format: string, ...args: any[]): void
}

let globalEnabled = false

export function setGlobalEnabled(enabled: boolean): void {
  globalEnabled = enabled
  if (enabled) {
    debugLib.enable('*')
  }
}

/**
 * Create a logger with convenience methods
 */
export function createLogger(namespace: string): Logger {
  const log = debugLib(namespace) as unknown as Logger
  
  // Alias methods for convenience
  log.debug = log
  log.info = log
  log.warn = log
  log.error = log
  
  return log
}

// Pre-create commonly used loggers
export const log = {
  gateway: createLogger("qqbot:gateway"),
  api: createLogger("qqbot:api"),
  inbound: createLogger("qqbot:inbound"),
  outbound: createLogger("qqbot:outbound"),
  access: createLogger("qqbot:access"),
  group: createLogger("qqbot:group"),
  command: createLogger("qqbot:command"),
  config: createLogger("qqbot:config"),
  session: createLogger("qqbot:session"),
  upload: createLogger("qqbot:upload"),
}