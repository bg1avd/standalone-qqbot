/**
 * Minimal debug-based logger with namespace support.
 * Enabled via DEBUG env var: DEBUG=qqbot:* or DEBUG=qqbot:gateway,qqbot:api
 */
import debugLib from "debug";
let globalEnabled = false;
export function setGlobalEnabled(enabled) {
    globalEnabled = enabled;
    if (enabled) {
        debugLib.enable('*');
    }
}
/**
 * Create a logger with convenience methods
 */
export function createLogger(namespace) {
    const log = debugLib(namespace);
    // Alias methods for convenience
    log.debug = log;
    log.info = log;
    log.warn = log;
    log.error = log;
    return log;
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
    chunked: createLogger("qqbot:chunked"),
    voice: createLogger("qqbot:voice"),
};
//# sourceMappingURL=logger.js.map