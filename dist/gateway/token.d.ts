/**
 * Token Manager — 获取并自动刷新 QQ Open Platform access_token
 *
 * QQ access_token 有效期 24 小时，SDK 在启动时获取，
 * 并在剩余 5 分钟时自动刷新。后台有一个定时刷新线程。
 */
export interface TokenInfo {
    accessToken: string;
    expiresAt: number;
}
type TokenChangeCallback = (token: string) => void;
/**
 * 获取有效 token（从缓存或重新获取）。
 * 内部使用，外部通过 startBackgroundTokenRefresh() 启动自动刷新。
 */
export declare function getAccessToken(appId: string, clientSecret: string): Promise<string>;
/**
 * 强制刷新 token（清除缓存后重新获取）。
 */
export declare function refreshAccessToken(appId: string, clientSecret: string): Promise<string>;
/**
 * 清除 token 缓存（强制下次重新获取）。
 */
export declare function clearTokenCache(appId: string): void;
/**
 * 启动后台 token 刷新线程。
 * 启动后自动在过期前刷新，并在刷新成功后调用 onRefresh 回调。
 */
export declare function startBackgroundTokenRefresh(appId: string, clientSecret: string, callbacks?: {
    onRefresh?: TokenChangeCallback;
    onError?: (err: Error) => void;
}): void;
/**
 * 停止后台 token 刷新线程。
 */
export declare function stopBackgroundTokenRefresh(appId: string): void;
/**
 * 清理所有 token（退出时调用）。
 */
export declare function flushAllTokens(): void;
export {};
//# sourceMappingURL=token.d.ts.map