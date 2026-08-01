import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY } from "../../domain/prefs";
import {
  ASSISTANT_SESSIONS_CHANGED_EVENT,
  createEmptySession,
  getActiveSessionId,
  getSession,
  hydrateAssistantSessions,
  upsertSession,
  type AssistantSessionMessage,
} from "../../domain/assistant/assistantSessions";
import { usePersistedState } from "../usePersistedState";

export type AssistantUiMessage = AssistantSessionMessage;

interface ActiveChatSnapshot {
  activeSessionId: string | null;
  messages: AssistantUiMessage[];
  sessionId: string | undefined;
}

function loadActiveChat(): ActiveChatSnapshot {
  const activeSessionId = getActiveSessionId();
  if (!activeSessionId) {
    return { activeSessionId: null, messages: [], sessionId: undefined };
  }
  const session = getSession(activeSessionId);
  if (!session) {
    return { activeSessionId, messages: [], sessionId: undefined };
  }
  return {
    activeSessionId,
    messages: session.messages,
    sessionId: session.sessionId,
  };
}

export interface AssistantChatSession {
  activeSessionId: string | null;
  activeSessionIdRef: MutableRefObject<string | null>;
  messages: AssistantUiMessage[];
  messagesRef: MutableRefObject<AssistantUiMessage[]>;
  setMessages: (messages: AssistantUiMessage[]) => void;
  /** Server-side conversation id (undefined until the first reply). */
  sessionId: string | undefined;
  sessionIdRef: MutableRefObject<string | undefined>;
  setSessionId: (sessionId: string | undefined) => void;
  draft: string;
  draftRef: MutableRefObject<string>;
  setDraft: (value: string | ((prev: string) => string)) => void;
  error: string | null;
  setError: (error: string | null) => void;
  /** Write messages into the active session, creating one when needed. */
  persistMessages: (
    messages: AssistantUiMessage[],
    serverSessionId: string | undefined,
  ) => string;
  /** Start a fresh local session (prior sessions stay in history). */
  startNewSession: () => void;
}

/**
 * Owns the assistant chat transcript: active session, message list, per-session
 * composer draft, and cross-tab session sync.
 *
 * `sendingRef` is shared with the stream hook so an external session update
 * cannot swap the transcript out from under an in-flight request.
 */
export function useAssistantChatSession(
  sendingRef: MutableRefObject<boolean>,
): AssistantChatSession {
  const initial = loadActiveChat();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(
    initial.activeSessionId,
  );
  const [messages, setMessages] = useState<AssistantUiMessage[]>(initial.messages);
  const [sessionId, setSessionId] = useState<string | undefined>(initial.sessionId);
  const [error, setError] = useState<string | null>(null);

  const [draftBySession, setDraftBySession] = usePersistedState<Record<string, string>>(
    ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY,
    {},
    { storage: "session", persistDebounceMs: 400 },
  );

  const activeSessionIdRef = useRef(activeSessionId);
  const messagesRef = useRef(messages);
  const sessionIdRef = useRef(sessionId);

  const draftSessionKey = activeSessionId ?? "none";
  const draft = draftBySession[draftSessionKey] ?? "";
  const draftRef = useRef(draft);

  activeSessionIdRef.current = activeSessionId;
  messagesRef.current = messages;
  sessionIdRef.current = sessionId;
  draftRef.current = draft;

  const setDraft = useCallback(
    (value: string | ((prev: string) => string)) => {
      setDraftBySession((prev) => {
        const key = activeSessionIdRef.current ?? "none";
        const current = prev[key] ?? "";
        const next = typeof value === "function" ? value(current) : value;
        if (next === current) return prev;
        return { ...prev, [key]: next };
      });
    },
    [setDraftBySession],
  );

  useEffect(() => {
    void hydrateAssistantSessions();
  }, []);

  useEffect(() => {
    const onChange = () => {
      const next = loadActiveChat();
      if (next.activeSessionId === activeSessionIdRef.current) {
        // Same session may have been updated elsewhere — refresh if not sending.
        if (!sendingRef.current) {
          setMessages(next.messages);
          setSessionId(next.sessionId);
        }
        return;
      }
      setActiveSessionId(next.activeSessionId);
      setMessages(next.messages);
      setSessionId(next.sessionId);
      setError(null);
    };
    window.addEventListener(ASSISTANT_SESSIONS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ASSISTANT_SESSIONS_CHANGED_EVENT, onChange);
  }, [sendingRef]);

  const persistMessages = useCallback(
    (nextMessages: AssistantUiMessage[], nextServerSessionId: string | undefined) => {
      let id = activeSessionIdRef.current;
      if (!id) {
        const created = createEmptySession();
        id = created.id;
        setActiveSessionId(id);
        activeSessionIdRef.current = id;
      }
      upsertSession({
        id,
        messages: nextMessages,
        sessionId: nextServerSessionId,
      });
      return id;
    },
    [],
  );

  const startNewSession = useCallback(() => {
    const created = createEmptySession();
    setActiveSessionId(created.id);
    activeSessionIdRef.current = created.id;
    setMessages([]);
    setSessionId(undefined);
    setError(null);
    setDraft("");
  }, [setDraft]);

  return {
    activeSessionId,
    activeSessionIdRef,
    messages,
    messagesRef,
    setMessages,
    sessionId,
    sessionIdRef,
    setSessionId,
    draft,
    draftRef,
    setDraft,
    error,
    setError,
    persistMessages,
    startNewSession,
  };
}
