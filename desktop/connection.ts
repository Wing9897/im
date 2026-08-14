import * as fs from 'node:fs';
import * as path from 'node:path';

/** Desktop shell connection mode persisted in userData/connection.json */
export type ConnectionMode = 'host' | 'client';

export interface ConnectionConfig {
  mode: ConnectionMode;
  /** Remote server origin/base URL when mode is `client` (e.g. http://192.168.1.10:18820) */
  serverUrl?: string;
  /**
   * When true, loopback may call POST /setup/reset-password (forgot-password rescue).
   * Default false. Arming requires write access to this file (OS account / ACLs).
   * The server clears the flag back to false after a successful reset.
   */
  resetPasswordForLocal?: boolean;
}

export const DEFAULT_CONNECTION: ConnectionConfig = { mode: 'host' };

export const CONNECTION_FILENAME = 'connection.json';

export function connectionFilePath(userDataPath: string): string {
  return path.join(userDataPath, CONNECTION_FILENAME);
}

/** Strip trailing slash; keep origin+path if present. */
export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/** Accept only http(s) remote URLs for client mode. */
export function isHttpOrHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Coerce unknown JSON into a safe ConnectionConfig.
 * Invalid client configs (missing/invalid serverUrl) fall back to host.
 * Preserves ``resetPasswordForLocal`` when explicitly true.
 * Unknown legacy keys (e.g. old LAN bind flag) are dropped on normalize/save.
 */
export function normalizeConnection(raw: unknown): ConnectionConfig {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_CONNECTION };
  }

  const obj = raw as Record<string, unknown>;
  const mode: ConnectionMode = obj.mode === 'client' ? 'client' : 'host';
  const serverUrl =
    typeof obj.serverUrl === 'string' && obj.serverUrl.trim()
      ? normalizeServerUrl(obj.serverUrl)
      : undefined;
  const resetPasswordForLocal = obj.resetPasswordForLocal === true;

  if (mode === 'client') {
    if (!serverUrl || !isHttpOrHttpsUrl(serverUrl)) {
      console.warn(
        '[connection] client mode without valid http(s) serverUrl; falling back to host',
      );
      return {
        ...DEFAULT_CONNECTION,
        ...(resetPasswordForLocal ? { resetPasswordForLocal: true } : {}),
      };
    }
    return {
      mode: 'client',
      serverUrl,
      ...(resetPasswordForLocal ? { resetPasswordForLocal: true } : {}),
    };
  }

  return {
    mode: 'host',
    ...(serverUrl ? { serverUrl } : {}),
    ...(resetPasswordForLocal ? { resetPasswordForLocal: true } : {}),
  };
}

/** Load connection.json from Electron userData; missing/corrupt → host default. */
export function loadConnection(userDataPath: string): ConnectionConfig {
  const filePath = connectionFilePath(userDataPath);
  try {
    if (!fs.existsSync(filePath)) {
      return { ...DEFAULT_CONNECTION };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    return normalizeConnection(JSON.parse(text));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[connection] Failed to load ${filePath}: ${message}`);
    return { ...DEFAULT_CONNECTION };
  }
}

/** Persist connection.json (creates userData dir if needed). */
export function saveConnection(
  userDataPath: string,
  config: ConnectionConfig,
): ConnectionConfig {
  // Preserve resetPasswordForLocal from disk unless the caller sets it explicitly
  // (mode switches must not wipe a manually armed rescue flag).
  const onDisk = loadConnection(userDataPath);
  const hasExplicitResetFlag = Object.prototype.hasOwnProperty.call(
    config,
    'resetPasswordForLocal',
  );
  const resetPasswordForLocal = hasExplicitResetFlag
    ? config.resetPasswordForLocal === true
    : onDisk.resetPasswordForLocal === true;
  const normalized = normalizeConnection({
    ...config,
    resetPasswordForLocal,
  });
  const filePath = connectionFilePath(userDataPath);
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[connection] Failed to save ${filePath}: ${message}`);
    throw err;
  }
  return normalized;
}

/** Ensure `?desktop=1` is present on a shell load URL. */
export function withDesktopQuery(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('desktop', '1');
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * URL loaded into BrowserWindow.
 * - host + prod → localhost:serverPort
 * - host + dev → localhost:viteDevPort
 * - client → connection.serverUrl (+ desktop=1)
 */
export function resolveShellLoadUrl(
  connection: ConnectionConfig,
  opts: { devMode: boolean; serverPort: number; viteDevPort: number },
): string {
  if (connection.mode === 'client' && connection.serverUrl) {
    return withDesktopQuery(connection.serverUrl);
  }
  const base = opts.devMode
    ? `http://localhost:${opts.viteDevPort}`
    : `http://localhost:${opts.serverPort}`;
  return `${base}/?desktop=1`;
}

/**
 * Base URL for analysis SSE notifications — follows connection mode
 * (remote origin in client mode, not always localhost).
 */
export function resolveNotificationServerUrl(
  connection: ConnectionConfig,
  serverPort: number,
): string {
  if (connection.mode === 'client' && connection.serverUrl) {
    try {
      return new URL(connection.serverUrl).origin;
    } catch {
      return normalizeServerUrl(connection.serverUrl);
    }
  }
  return `http://localhost:${serverPort}`;
}
