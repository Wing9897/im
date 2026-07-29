/** sessionStorage keys for unsaved Chat Editor drafts (cleared on successful save). */

export const CHAT_EDITOR_TEMPLATE_USAGE_KEY = "im:task-template-usage";

export function chatEditorFormStorageKey(taskId: string | undefined): string {
  return taskId
    ? `im:tasks:chat-editor:form:${taskId}`
    : "im:tasks:chat-editor:form:new";
}

export function chatEditorMessagesStorageKey(taskId: string | undefined): string {
  return taskId
    ? `im:tasks:chat-editor:messages:${taskId}`
    : "im:tasks:chat-editor:messages:new";
}

export function chatEditorInputStorageKey(taskId: string | undefined): string {
  return taskId
    ? `im:tasks:chat-editor:input:${taskId}`
    : "im:tasks:chat-editor:input:new";
}

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
