/**
 * Persisted connection mode, server base URL, and device session tokens.
 * Replaces “paste household API key” as the primary remote auth path.
 */

export type ConnectionMode = "local" | "remote";

export interface DeviceSessionTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt?: string;
  refreshExpiresAt?: string;
  deviceId?: string;
  deviceLabel?: string;
}

export interface ConnectionSnapshot {
  connectionMode: ConnectionMode | null;
  /** Custom API origin for remote / thin-client; null → use resolveBaseUrl fallbacks. */
  serverBaseUrl: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
}

const STORAGE_KEY = "im:connection";

const EMPTY: ConnectionSnapshot = {
  connectionMode: null,
  serverBaseUrl: null,
  accessToken: null,
  refreshToken: null,
  accessExpiresAt: null,
  refreshExpiresAt: null,
  deviceId: null,
  deviceLabel: null,
};

type Listener = () => void;

let cached: ConnectionSnapshot | null = null;
const listeners = new Set<Listener>();

/** Strip trailing slashes; empty → null. Shared by store + Desktop bridge. */
export function normalizeBaseUrl(url: string | null | undefined): string | null {
  const trimmed = (url ?? "").trim().replace(/\/+$/, "");
  return trimmed || null;
}

function readRaw(): ConnectionSnapshot {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<ConnectionSnapshot>;
    const mode = parsed.connectionMode;
    return {
      connectionMode: mode === "local" || mode === "remote" ? mode : null,
      serverBaseUrl: normalizeBaseUrl(parsed.serverBaseUrl ?? null),
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      accessExpiresAt:
        typeof parsed.accessExpiresAt === "string" ? parsed.accessExpiresAt : null,
      refreshExpiresAt:
        typeof parsed.refreshExpiresAt === "string" ? parsed.refreshExpiresAt : null,
      deviceId: typeof parsed.deviceId === "string" ? parsed.deviceId : null,
      deviceLabel: typeof parsed.deviceLabel === "string" ? parsed.deviceLabel : null,
    };
  } catch {
    return { ...EMPTY };
  }
}

function writeRaw(next: ConnectionSnapshot): void {
  cached = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribe to connection/session mutations (apiClient / boot gate). */
export function subscribeConnection(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getConnectionSnapshot(): ConnectionSnapshot {
  // Re-read when cache empty; writeRaw keeps cache in sync. Tests that clear
  // localStorage directly should call `_resetConnectionStoreForTests`.
  if (!cached) cached = readRaw();
  return cached;
}

export function setConnectionMode(mode: ConnectionMode | null): void {
  const prev = getConnectionSnapshot();
  writeRaw({ ...prev, connectionMode: mode });
}

export function setServerBaseUrl(url: string | null): void {
  const prev = getConnectionSnapshot();
  writeRaw({ ...prev, serverBaseUrl: normalizeBaseUrl(url) });
}

export function hasDeviceSession(): boolean {
  const snap = getConnectionSnapshot();
  return Boolean(snap.accessToken?.trim() && snap.refreshToken?.trim());
}

export function getAccessToken(): string | undefined {
  return getConnectionSnapshot().accessToken?.trim() || undefined;
}

export function getRefreshToken(): string | undefined {
  return getConnectionSnapshot().refreshToken?.trim() || undefined;
}

/**
 * Update access token only (no fake refresh). ``hasDeviceSession`` stays false
 * until a real refresh token is present.
 */
export function setAccessTokenOnly(token: string | null): void {
  const prev = getConnectionSnapshot();
  const trimmed = (token ?? "").trim();
  writeRaw({
    ...prev,
    accessToken: trimmed || null,
  });
}

export function saveDeviceSession(tokens: DeviceSessionTokens): void {
  const prev = getConnectionSnapshot();
  const next: ConnectionSnapshot = {
    ...prev,
    accessToken: tokens.accessToken.trim(),
    refreshToken: tokens.refreshToken.trim(),
    accessExpiresAt: tokens.accessExpiresAt ?? null,
    refreshExpiresAt: tokens.refreshExpiresAt ?? null,
    deviceId: tokens.deviceId ?? prev.deviceId,
    deviceLabel: tokens.deviceLabel ?? prev.deviceLabel,
  };
  writeRaw(next);
}

/** Reset to local / host-origin defaults (Desktop host boot, logout recovery). */
export function resetToLocalConnectionDefaults(): void {
  const prev = getConnectionSnapshot();
  writeRaw({
    ...prev,
    connectionMode: "local",
    serverBaseUrl: null,
  });
}

export function clearDeviceSession(): void {
  const prev = getConnectionSnapshot();
  writeRaw({
    ...prev,
    accessToken: null,
    refreshToken: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    deviceId: null,
    deviceLabel: null,
  });
}

/** Clear tokens + connection preferences (logout → re-run wizard). */
export function clearConnection(): void {
  writeRaw({ ...EMPTY });
}

/** Test helper: wipe in-memory cache. Production builds drop the body. */
export function _resetConnectionStoreForTests(): void {
  cached = null;
  listeners.clear();
}
