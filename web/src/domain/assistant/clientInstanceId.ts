import { ASSISTANT_CLIENT_INSTANCE_STORAGE_KEY } from "../prefs/keys";

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
    const existing = window.localStorage.getItem(ASSISTANT_CLIENT_INSTANCE_STORAGE_KEY);
    if (existing?.trim()) {
      return existing.trim();
    }
    const created = newClientInstanceId();
    window.localStorage.setItem(ASSISTANT_CLIENT_INSTANCE_STORAGE_KEY, created);
    return created;
  } catch {
    return newClientInstanceId();
  }
}
