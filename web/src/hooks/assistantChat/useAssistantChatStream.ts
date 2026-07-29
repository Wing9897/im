import { useCallback, useState, type MutableRefObject } from "react";

import {
  streamAgentChat,
  type AgentChatMessage,
  type AgentStreamToolDoneEvent,
  type AgentStreamToolStartEvent,
} from "../../api/agent";
import type { LiveToolStep } from "../../domain/assistant/liveToolStep";
import {
  AGENT_SURFACE_TASK_EDITOR,
  getTaskEditorDraftBridge,
  isTaskEditorPath,
} from "../../domain/tasks/taskEditorDraftBridge";
import { parseTaskAssistantResponse } from "../../domain/tasks/parseTaskAssistantResponse";
import { messageForErrorCode } from "../../i18n/errorCodes";
import { getAppLocale } from "../../i18n/locale";
import { toErrorMessage } from "../../utils/errors";
import type { AssistantChatSession, AssistantUiMessage } from "./useAssistantChatSession";
import type { AssistantChatVoice } from "./useAssistantChatVoice";

/** When on a mounted task editor route, attach surface + live draft for advisor consult. */
function taskEditorAgentExtras(): {
  surface?: typeof AGENT_SURFACE_TASK_EDITOR;
  currentTask?: ReturnType<
    NonNullable<ReturnType<typeof getTaskEditorDraftBridge>>["getCurrentTask"]
  >;
} {
  if (typeof window === "undefined") return {};
  if (!isTaskEditorPath(window.location.pathname)) return {};
  const bridge = getTaskEditorDraftBridge();
  if (!bridge) return {};
  return {
    surface: AGENT_SURFACE_TASK_EDITOR,
    currentTask: bridge.getCurrentTask(),
  };
}

function applyFinalTaskConfig(taskConfig: unknown, assistantMessage: string): void {
  if (taskConfig == null) return;
  const bridge = getTaskEditorDraftBridge();
  if (!bridge) return;
  const parsed = parseTaskAssistantResponse({
    message: assistantMessage || "",
    taskConfig,
  });
  if (!parsed.ok) return;
  if (Object.keys(parsed.data.taskConfig).length === 0) return;
  bridge.applyTaskConfig(parsed.data.taskConfig);
}

function newId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface UseAssistantChatStreamOptions {
  session: AssistantChatSession;
  voice: AssistantChatVoice;
  sendingRef: MutableRefObject<boolean>;
}

export interface AssistantChatStream {
  sending: boolean;
  liveToolSteps: LiveToolStep[];
  sendContent: (raw: string) => Promise<void>;
}

/**
 * Owns one agent turn: optimistic user message, live tool-step feed, and the
 * assistant reply (including rollback of the transcript on failure).
 */
export function useAssistantChatStream({
  session,
  voice,
  sendingRef,
}: UseAssistantChatStreamOptions): AssistantChatStream {
  const [sending, setSending] = useState(false);
  const [liveToolSteps, setLiveToolSteps] = useState<LiveToolStep[]>([]);

  const {
    messagesRef,
    sessionIdRef,
    setMessages,
    setSessionId,
    setDraft,
    draftRef,
    setError,
    persistMessages,
  } = session;
  const { calendarTaskIdRef, heardTextRef, speakIfEnabled, stopSpeaking } = voice;

  const sendContent = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || sendingRef.current) {
        return;
      }

      stopSpeaking();
      setError(null);
      sendingRef.current = true;
      setSending(true);
      setLiveToolSteps([]);
      heardTextRef.current = "";

      const upsertLiveStep = (
        event: AgentStreamToolStartEvent | AgentStreamToolDoneEvent,
        status: LiveToolStep["status"],
      ) => {
        setLiveToolSteps((prev) => {
          const index = prev.findIndex(
            (step) =>
              step.name === event.name &&
              step.status === "running" &&
              JSON.stringify(step.arguments) === JSON.stringify(event.arguments),
          );
          const nextStep: LiveToolStep = {
            name: event.name,
            arguments: event.arguments,
            resultSummary: "resultSummary" in event ? event.resultSummary : "",
            status,
          };
          if (index >= 0) {
            const next = [...prev];
            next[index] = nextStep;
            return next;
          }
          return [...prev, nextStep];
        });
      };

      const priorMessages = messagesRef.current;
      const priorSessionId = sessionIdRef.current;
      const userMessage: AssistantUiMessage = {
        id: newId(),
        role: "user",
        content,
      };
      const withUser = [...priorMessages, userMessage];
      setMessages(withUser);
      setDraft("");
      draftRef.current = "";
      persistMessages(withUser, priorSessionId);

      const history: AgentChatMessage[] = withUser.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      try {
        const response = await streamAgentChat(
          {
            messages: history,
            sessionId: priorSessionId,
            locale: getAppLocale(),
            calendarTaskId: calendarTaskIdRef.current,
            ...taskEditorAgentExtras(),
          },
          {
            onToolStart: (event) => upsertLiveStep(event, "running"),
            onToolDone: (event) => upsertLiveStep(event, "done"),
          },
        );
        setSessionId(response.sessionId);
        if (response.error) {
          // Soft agent failures (e.g. Ollama refused) arrive as stream `error`
          // events — toast only; do not persist the failure as a sticky bubble.
          const toastText =
            messageForErrorCode(response.error) ??
            (response.message?.trim() ? response.message : response.error);
          setError(toastText);
          setDraft(content);
          draftRef.current = content;
          setMessages(priorMessages);
          persistMessages(priorMessages, priorSessionId);
          return;
        }
        applyFinalTaskConfig(response.taskConfig, response.message);
        const assistantMessage: AssistantUiMessage = {
          id: newId(),
          role: "assistant",
          content: response.message,
          toolCalls: response.toolCalls?.length ? response.toolCalls : undefined,
        };
        const withAssistant = [...withUser, assistantMessage];
        setMessages(withAssistant);
        persistMessages(withAssistant, response.sessionId);
        void speakIfEnabled(response.message);
      } catch (err) {
        setError(toErrorMessage(err));
        setDraft(content);
        draftRef.current = content;
        setMessages(priorMessages);
        persistMessages(priorMessages, priorSessionId);
      } finally {
        setLiveToolSteps([]);
        sendingRef.current = false;
        setSending(false);
      }
    },
    [
      calendarTaskIdRef,
      draftRef,
      heardTextRef,
      messagesRef,
      persistMessages,
      sendingRef,
      sessionIdRef,
      setDraft,
      setError,
      setMessages,
      setSessionId,
      speakIfEnabled,
      stopSpeaking,
    ],
  );

  return { sending, liveToolSteps, sendContent };
}
