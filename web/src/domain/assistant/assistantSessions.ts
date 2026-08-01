import type { AgentToolCallSummary } from "../../api/agent";
import {
  fetchAssistantSessions,
  putAssistantSessions,
  type AssistantSessionPayload,
} from "../../api/uiPrefs";
import i18n from "../../i18n";
import { logWarn } from "../../utils/logger";
import { getClientInstanceId } from "./clientInstanceId";

/** Dispatched when the in-memory session list / active id changes. */
export const ASSISTANT_SESSIONS_CHANGED_EVENT = "im:assistant-sessions-changed";

const MAX_SESSIONS = 50;
const TITLE_MAX_LEN = 40;

export interface AssistantSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: AgentToolCallSummary[];
}

export interface AssistantSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: AssistantSessionMessage[];
  /** Server Agent session id (conversation clock); optional until first reply. */
  sessionId?: string;
}

type SessionsCache = {
  sessions: AssistantSession[];
  activeSessionId: string | null;
};

let cache: SessionsCache | null = null;
let hydratePromise: Promise<void> | null = null;

function newChatTitle(): string {
  return String(i18n.t("assistant:history.new"));
}

function newLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function notifyChanged(): void {
  window.dispatchEvent(new Event(ASSISTANT_SESSIONS_CHANGED_EVENT));
}

function normalizeSession(raw: unknown): AssistantSession | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as AssistantSession;
  if (
    typeof item.id !== "string" ||
    typeof item.title !== "string" ||
    typeof item.updatedAt !== "number" ||
    !Array.isArray(item.messages)
  ) {
    return null;
  }
  return {
    id: item.id,
    title: item.title,
    updatedAt: item.updatedAt,
    messages: item.messages,
    sessionId: typeof item.sessionId === "string" ? item.sessionId : undefined,
  };
}

function setCache(
  sessions: AssistantSession[],
  activeSessionId: string | null,
  options: { notify?: boolean } = {},
): void {
  const notify = options.notify ?? true;
  cache = {
    sessions: sessions.map((s) => ({ ...s, messages: [...s.messages] })),
    activeSessionId,
  };
  if (notify) notifyChanged();
}

function ensureCache(): SessionsCache {
  if (cache) return cache;
  cache = { sessions: [], activeSessionId: null };
  return cache;
}

function toPayload(sessions: AssistantSession[]): AssistantSessionPayload[] {
  return sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      ...(message.toolCalls ? { toolCalls: message.toolCalls } : {}),
    })),
    ...(session.sessionId ? { sessionId: session.sessionId } : {}),
  }));
}

function fromPayload(sessions: AssistantSessionPayload[] | null | undefined): AssistantSession[] {
  if (!sessions) return [];
  return sessions
    .map(normalizeSession)
    .filter((item): item is AssistantSession => item !== null);
}

async function persistCache(current: SessionsCache): Promise<boolean> {
  try {
    const saved = await putAssistantSessions({
      deviceId: getClientInstanceId(),
      sessions: toPayload(current.sessions),
      activeSessionId: current.activeSessionId,
    });
    setCache(fromPayload(saved.sessions), saved.activeSessionId ?? null, { notify: false });
    return true;
  } catch (error) {
    logWarn("[assistantSessions] failed to persist", error);
    return false;
  }
}

function writeAll(
  sessions: AssistantSession[],
  activeSessionId: string | null,
  options: { notify?: boolean } = {},
): void {
  const notify = options.notify ?? true;
  const trimmed = [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  let active = activeSessionId;
  if (active && !trimmed.some((s) => s.id === active)) {
    active = null;
  }
  setCache(trimmed, active, { notify });
  const snapshot = ensureCache();
  void persistCache(snapshot);
}

export function titleFromMessages(messages: readonly AssistantSessionMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return newChatTitle();
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  if (text.length <= TITLE_MAX_LEN) return text;
  return `${text.slice(0, TITLE_MAX_LEN - 1)}…`;
}

export function listSessions(): AssistantSession[] {
  return [...ensureCache().sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): AssistantSession | undefined {
  return ensureCache().sessions.find((s) => s.id === id);
}

export function getActiveSessionId(): string | null {
  return ensureCache().activeSessionId;
}

export function setActiveSessionId(
  id: string | null,
  options: { notify?: boolean } = {},
): void {
  const current = ensureCache();
  writeAll(current.sessions, id, options);
}

export function upsertSession(
  session: Omit<AssistantSession, "title" | "updatedAt"> & {
    title?: string;
    updatedAt?: number;
  },
): AssistantSession {
  const next: AssistantSession = {
    id: session.id,
    title: session.title ?? titleFromMessages(session.messages),
    updatedAt: session.updatedAt ?? Date.now(),
    messages: session.messages,
    sessionId: session.sessionId,
  };
  const current = ensureCache();
  const others = current.sessions.filter((s) => s.id !== next.id);
  writeAll([next, ...others], current.activeSessionId);
  return next;
}

/** Delete a session (still supported — PUT without that session). */
export function deleteSession(id: string): void {
  const current = ensureCache();
  const remaining = current.sessions.filter((s) => s.id !== id);
  const wasActive = current.activeSessionId === id;
  writeAll(remaining, wasActive ? null : current.activeSessionId, {
    notify: !wasActive,
  });
  if (wasActive) {
    // writeAll already cleared active; ensure notify for UI.
    notifyChanged();
  }
}

export function createEmptySession(): AssistantSession {
  const current = ensureCache();
  const kept = current.sessions.filter((s) => s.messages.length > 0);
  const session: AssistantSession = {
    id: newLocalId("asst"),
    title: newChatTitle(),
    updatedAt: Date.now(),
    messages: [],
  };
  writeAll([session, ...kept], session.id, { notify: false });
  notifyChanged();
  return session;
}

/**
 * Hydrate from SQLite via API. Empty server → empty list (no localStorage migrate).
 */
export async function hydrateAssistantSessions(): Promise<void> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const deviceId = getClientInstanceId();
        const response = await fetchAssistantSessions(deviceId);
        if (response.configured && response.sessions) {
          setCache(
            fromPayload(response.sessions),
            response.activeSessionId ?? null,
            { notify: true },
          );
          return;
        }

        setCache([], null, { notify: false });
      } catch (error) {
        logWarn("[assistantSessions] failed to hydrate", error);
        ensureCache();
      }
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

/** Test helper. */
export function resetAssistantSessionsCacheForTests(): void {
  cache = null;
  hydratePromise = null;
}
