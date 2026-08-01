const CLIENT_INSTANCE_STORAGE_KEY = "im:assistant:client-instance-id";

function newClientInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-browser / per-Electron-profile id for assistant prefs device slot. */
export function getClientInstanceId(): string {
  if (typeof window === "undefined") {
    return newClientInstanceId();
  }
  try {
    const existing = window.localStorage.getItem(CLIENT_INSTANCE_STORAGE_KEY);
    if (existing?.trim()) {
      return existing.trim();
    }
    const created = newClientInstanceId();
    window.localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, created);
    return created;
  } catch {
    return newClientInstanceId();
  }
}

/** Test helper — clears stored id so the next read generates a fresh one. */
export function resetClientInstanceIdForTests(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLIENT_INSTANCE_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
