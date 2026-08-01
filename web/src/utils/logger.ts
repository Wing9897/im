/**
 * 集中式前端日誌工具。
 * 開發環境輸出到 console，生產環境靜默。
 */

const isDev = import.meta.env.DEV;

export function logWarn(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.warn(message, ...args);
  }
}

export function logError(message: string, ...args: unknown[]): void {
  if (isDev) {
    console.error(message, ...args);
  }
}
