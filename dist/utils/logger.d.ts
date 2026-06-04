/**
 * Minimal debug-based logger with namespace support.
 * Enabled via DEBUG env var: DEBUG=qqbot:* or DEBUG=qqbot:gateway,qqbot:api
 */
/**
 * Logger interface - extends debug.Debugger with convenience methods
 */
export interface Logger {
    (format: string, ...args: any[]): void;
    enabled: boolean;
    namespace: string;
    debug(format: string, ...args: any[]): void;
    info(format: string, ...args: any[]): void;
    warn(format: string, ...args: any[]): void;
    error(format: string, ...args: any[]): void;
}
export declare function setGlobalEnabled(enabled: boolean): void;
/**
 * Create a logger with convenience methods
 */
export declare function createLogger(namespace: string): Logger;
export declare const log: {
    gateway: Logger;
    api: Logger;
    inbound: Logger;
    outbound: Logger;
    access: Logger;
    group: Logger;
    command: Logger;
    config: Logger;
    session: Logger;
    upload: Logger;
    chunked: Logger;
    voice: Logger;
};
//# sourceMappingURL=logger.d.ts.map