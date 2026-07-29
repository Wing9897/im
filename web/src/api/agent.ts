/**
 * Agent chat API — text in / text out with optional tool-call summaries.
 * Matches server AgentRuntime response shape (camelCase).
 *
 * ``streamAgentChat`` uses POST /chat/stream (NDJSON) to show tool steps live;
 * LLM calls remain non-streaming on the server.
 */

import { apiClient, resolveBaseUrl, ApiRequestError, NetworkError } from "./client";
import type { components } from "./generated/schema";
import type { AppLocale } from "../i18n/locale";

type OpenApiAgentChatBody = components["schemas"]["AgentChatBody"];
type OpenApiAgentChatResponse = components["schemas"]["AgentChatResponse"];
type OpenApiAgentToolCallSummary = components["schemas"]["AgentToolCallSummary"];

type AgentChatRole = "user" | "assistant" | "system";

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
}

/** Client-normalized tool summary (``arguments`` always present). */
export type AgentToolCallSummary = Omit<OpenApiAgentToolCallSummary, "arguments"> & {
  arguments: Record<string, unknown>;
};

interface AgentChatRequest {
  messages: AgentChatMessage[];
  sessionId?: string;
  /** UI locale for AI output language; server falls back to ``ui_locale``. */
  locale?: AppLocale;
  /**
   * Default create target when calendar tools omit taskId.
   * ``__user__`` / empty → unassigned (用戶或助手).
   */
  calendarTaskId?: string | null;
  /** Page gate: only task create/edit sends ``task_editor``. */
  surface?: OpenApiAgentChatBody["surface"];
  /** Live Chat Editor draft for ``tasks.consult_advisor`` context. */
  currentTask?: OpenApiAgentChatBody["currentTask"];
}

/** Client-normalized final payload (``sessionId`` / ``toolCalls`` always present). */
export type AgentChatResponse = {
  message: string;
  sessionId: string;
  toolCalls: AgentToolCallSummary[];
  /** Present when the server degraded (e.g. LLM unavailable) but still returned 200. */
  error?: string;
  /** Optional task form patch from a successful advisor consult (task editor surface). */
  taskConfig?: OpenApiAgentChatResponse["taskConfig"];
};

function agentChatRequestBody(body: AgentChatRequest): Record<string, unknown> {
  return {
    messages: body.messages,
    ...(body.sessionId ? { sessionId: body.sessionId } : {}),
    ...(body.locale ? { locale: body.locale } : {}),
    ...(body.calendarTaskId != null && body.calendarTaskId !== ""
      ? { calendarTaskId: body.calendarTaskId }
      : {}),
    ...(body.surface ? { surface: body.surface } : {}),
    ...(body.currentTask != null ? { currentTask: body.currentTask } : {}),
  };
}

export type AgentStreamEventType =
  | "llm_start"
  | "tool_start"
  | "tool_done"
  | "final"
  | "error";

export interface AgentStreamLlmStartEvent {
  type: "llm_start";
  round: number;
}

export interface AgentStreamToolStartEvent {
  type: "tool_start";
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentStreamToolDoneEvent {
  type: "tool_done";
  name: string;
  arguments: Record<string, unknown>;
  resultSummary: string;
}

export interface AgentStreamFinalEvent extends AgentChatResponse {
  type: "final";
}

export interface AgentStreamErrorEvent {
  type: "error";
  message: string;
  sessionId?: string;
  toolCalls: AgentToolCallSummary[];
  error: string;
}

export type AgentStreamEvent =
  | AgentStreamLlmStartEvent
  | AgentStreamToolStartEvent
  | AgentStreamToolDoneEvent
  | AgentStreamFinalEvent
  | AgentStreamErrorEvent;

export interface AgentStreamHandlers {
  onEvent?: (event: AgentStreamEvent) => void;
  onLlmStart?: (round: number) => void;
  onToolStart?: (event: AgentStreamToolStartEvent) => void;
  onToolDone?: (event: AgentStreamToolDoneEvent) => void;
}

export interface AgentStreamOptions extends AgentStreamHandlers {
  signal?: AbortSignal;
  /** Wall-clock timeout for the whole stream (default 10 min). */
  timeoutMs?: number;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/x-ndjson, application/json",
    "Content-Type": "application/json",
  };
  const token = apiClient.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function parseStreamLine(line: string): AgentStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || typeof (parsed as AgentStreamEvent).type !== "string") {
    return null;
  }
  return parsed as AgentStreamEvent;
}

function dispatchStreamEvent(event: AgentStreamEvent, handlers: AgentStreamHandlers): void {
  handlers.onEvent?.(event);
  if (event.type === "llm_start") {
    handlers.onLlmStart?.(event.round);
  } else if (event.type === "tool_start") {
    handlers.onToolStart?.(event);
  } else if (event.type === "tool_done") {
    handlers.onToolDone?.(event);
  }
}

function toAgentChatResponse(event: AgentStreamFinalEvent | AgentStreamErrorEvent): AgentChatResponse {
  return {
    message: event.message,
    sessionId: event.sessionId ?? "",
    toolCalls: event.toolCalls ?? [],
    ...(event.error ? { error: event.error } : {}),
    ...("taskConfig" in event && event.taskConfig != null
      ? { taskConfig: event.taskConfig }
      : {}),
  };
}

/** Send a multi-turn chat turn to the built-in agent (calendar tools on server). */
export function postAgentChat(body: AgentChatRequest): Promise<AgentChatResponse> {
  return apiClient.post<AgentChatResponse>("/api/v1/agent/chat", agentChatRequestBody(body));
}

/**
 * Stream agent tool steps via NDJSON, then resolve with the final chat response.
 * LLM providers are still called non-streaming; only tool progress is streamed.
 */
export async function streamAgentChat(
  body: AgentChatRequest,
  handlers: AgentStreamOptions = {},
): Promise<AgentChatResponse> {
  const timeoutMs = handlers.timeoutMs ?? 600_000;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  handlers.signal?.addEventListener("abort", onAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  if (handlers.signal?.aborted) {
    controller.abort();
  }

  try {
    const response = await fetch(`${resolveBaseUrl()}/api/v1/agent/chat/stream`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(agentChatRequestBody(body)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ApiRequestError(response.status, {
        error: "AGENT_STREAM_FAILED",
        message: `Agent stream failed (${response.status})`,
      });
    }

    if (!response.body) {
      throw new NetworkError("Agent stream returned no body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResponse: AgentChatResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        const event = parseStreamLine(line);
        if (event) {
          dispatchStreamEvent(event, handlers);
          if (event.type === "final" || event.type === "error") {
            finalResponse = toAgentChatResponse(event);
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }

    const trailing = parseStreamLine(buffer);
    if (trailing) {
      dispatchStreamEvent(trailing, handlers);
      if (trailing.type === "final" || trailing.type === "error") {
        finalResponse = toAgentChatResponse(trailing);
      }
    }

    if (!finalResponse) {
      throw new NetworkError("Agent stream ended without a final response");
    }

    return finalResponse;
  } catch (error) {
    if (
      (error instanceof DOMException && error.name === "AbortError") ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      if (handlers.signal?.aborted) {
        throw new NetworkError("Request cancelled");
      }
      throw new NetworkError("Request timed out");
    }
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    handlers.signal?.removeEventListener("abort", onAbort);
  }
}
