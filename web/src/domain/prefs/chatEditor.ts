import {
  chatEditorFormStorageKey,
  chatEditorInputStorageKey,
  chatEditorMessagesStorageKey,
} from "./keys";

function readSessionJson(key: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when session holds a non-empty form draft (skip API overwrite on edit hydrate). */
export function hasMeaningfulChatEditorFormDraft(taskId: string | undefined): boolean {
  const parsed = readSessionJson(chatEditorFormStorageKey(taskId));
  if (!parsed || typeof parsed !== "object") return false;
  const record = parsed;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const prompt = typeof record.promptTemplate === "string" ? record.promptTemplate.trim() : "";
  const description =
    typeof record.description === "string" ? record.description.trim() : "";
  const channels = Array.isArray(record.channelIds) ? record.channelIds.length : 0;
  return Boolean(name || prompt || description || channels > 0);
}

export function clearChatEditorDrafts(taskId: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(chatEditorFormStorageKey(taskId));
    window.sessionStorage.removeItem(chatEditorMessagesStorageKey(taskId));
    window.sessionStorage.removeItem(chatEditorInputStorageKey(taskId));
  } catch {
    // ignore quota / private mode
  }
}
