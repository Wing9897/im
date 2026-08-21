/**
 * Unit tests for useAssistantChat host (session / draft / send / tool-steps).
 */
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AssistantChatProvider,
  useAssistantChat,
} from "./useAssistantChat";
import { ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY } from "../domain/prefs";
import {
  createEmptySession,
  resetAssistantSessionsCacheForTests,
  setActiveSessionId,
  upsertSession,
} from "../domain/assistant/assistantSessions";
import {
  clearTaskEditorDraftBridge,
  registerTaskEditorDraftBridge,
} from "../domain/tasks/taskEditorDraftBridge";
import {
  loadVoiceSettings,
  resetVoiceSettingsCacheForTests,
} from "../speech/voiceSettings";

const { mockStreamAgentChat, mockCreateSpeechPorts } = vi.hoisted(() => ({
  mockStreamAgentChat: vi.fn(),
  mockCreateSpeechPorts: vi.fn(),
}));

vi.mock("../api/agent", () => ({
  streamAgentChat: mockStreamAgentChat,
  postAgentChat: vi.fn(),
}));

vi.mock("../speech", async () => {
  const actual = await vi.importActual<typeof import("../speech")>("../speech");
  return {
    ...actual,
    createSpeechPorts: mockCreateSpeechPorts,
  };
});

vi.mock("../api/uiPrefs", async () => {
  const actual = await vi.importActual<typeof import("../api/uiPrefs")>("../api/uiPrefs");
  return {
    ...actual,
    fetchAssistantSessions: vi.fn(async () => ({
      configured: false,
      sessions: [],
      activeSessionId: null,
    })),
    putAssistantSessions: vi.fn(async (body: { sessions: unknown[]; activeSessionId: string | null }) => body),
    putAssistantVoiceIo: vi.fn(async (settings: unknown) => ({
      configured: true,
      settings,
    })),
  };
});

type ChatApi = ReturnType<typeof useAssistantChat>;

function Probe({ onApi }: { onApi: (api: ChatApi) => void }) {
  const api = useAssistantChat();
  useEffect(() => {
    onApi(api);
  });
  return null;
}

function mockPorts() {
  const handlers = new Set<(ev: { type: string; text?: string; message?: string }) => void>();
  const stt = {
    providerId: "browser",
    isAvailable: () => true,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    subscribe: (handler: (ev: { type: string; text?: string; message?: string }) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
  mockCreateSpeechPorts.mockReturnValue({
    stt,
    tts: {
      providerId: "browser",
      isAvailable: () => false,
      speak: vi.fn(async () => undefined),
      cancel: vi.fn(),
    },
  });
  return {
    stt,
    emit: (ev: { type: string; text?: string; message?: string }) => {
      for (const handler of handlers) handler(ev);
    },
  };
}

describe("useAssistantChat", () => {
  let host: HTMLDivElement;
  let root: Root;
  let latest: ChatApi | null = null;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    latest = null;
    window.localStorage.clear();
    window.sessionStorage.clear();
    resetAssistantSessionsCacheForTests();
    resetVoiceSettingsCacheForTests();
    clearTaskEditorDraftBridge();
    mockStreamAgentChat.mockReset();
    mockCreateSpeechPorts.mockReset();
    mockPorts();
    window.history.pushState({}, "", "/");
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    clearTaskEditorDraftBridge();
  });

  async function mount() {
    await act(async () => {
      root.render(
        createElement(
          AssistantChatProvider,
          null,
          createElement(Probe, {
            onApi: (next) => {
              latest = next;
            },
          }),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(latest).not.toBeNull();
    return () => latest!;
  }

  it("hydrates messages from the active session", async () => {
    const session = createEmptySession();
    upsertSession({
      id: session.id,
      messages: [{ id: "m1", role: "user", content: "hello" }],
      sessionId: "srv-1",
    });
    setActiveSessionId(session.id, { notify: false });

    const chat = await mount();
    expect(chat().messages.map((m) => m.content)).toContain("hello");
  });

  it("persists composer draft per session in sessionStorage", async () => {
    const chat = await mount();
    await act(async () => {
      chat().setDraft("draft text");
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    const raw = window.sessionStorage.getItem(ASSISTANT_COMPOSER_DRAFTS_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).toContain("draft text");
  });

  it("sends draft, records tool steps, then clears live steps", async () => {
    mockStreamAgentChat.mockImplementation(async (_body, handlers) => {
      handlers?.onToolStart?.({
        type: "tool_start",
        name: "calendar.window",
        arguments: { days: 1 },
      });
      handlers?.onToolDone?.({
        type: "tool_done",
        name: "calendar.window",
        arguments: { days: 1 },
        resultSummary: "ok",
      });
      return {
        sessionId: "srv-new",
        message: "done",
        toolCalls: [
          { name: "calendar.window", arguments: { days: 1 }, resultSummary: "ok" },
        ],
      };
    });

    const chat = await mount();
    await act(async () => {
      chat().setDraft("ask something");
    });
    expect(chat().draft).toBe("ask something");

    await act(async () => {
      await chat().sendDraft();
    });

    expect(chat().sending).toBe(false);
    expect(chat().liveToolSteps).toEqual([]);
    const assistant = chat().messages.find((m) => m.role === "assistant");
    expect(assistant?.content).toBe("done");
    expect(assistant?.toolCalls?.some((c) => c.name === "calendar.window")).toBe(true);
    expect(mockStreamAgentChat).toHaveBeenCalledTimes(1);
    expect(mockStreamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        worksetId: "__general__",
      }),
      expect.any(Object),
    );
  });

  it("forwards an overridden worksetId on send", async () => {
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-task",
      message: "ok",
      toolCalls: [],
    });

    const chat = await mount();
    await act(async () => {
      chat().setWorksetId("memo-task");
      chat().setDraft("記到日曆任務");
    });
    await act(async () => {
      await chat().sendDraft();
    });

    expect(mockStreamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        worksetId: "memo-task",
        messages: expect.arrayContaining([
          expect.objectContaining({ content: "記到日曆任務" }),
        ]),
      }),
      expect.any(Object),
    );
    expect(loadVoiceSettings().defaultWorksetId).toBe("memo-task");
  });

  it("clearChat starts a fresh local session", async () => {
    const chat = await mount();
    await act(async () => {
      chat().setDraft("x");
    });
    await act(async () => {
      mockStreamAgentChat.mockResolvedValue({
        sessionId: "srv-x",
        message: "y",
      });
      await chat().sendDraft();
    });
    const before = chat().activeSessionId;
    expect(before).toBeTruthy();
    await act(async () => {
      chat().clearChat();
    });
    expect(chat().messages).toEqual([]);
    expect(chat().draft).toBe("");
    expect(chat().activeSessionId).toBeTruthy();
    expect(chat().activeSessionId).not.toBe(before);
  });

  it("rolls back the turn on soft agent errors instead of persisting a sticky bubble", async () => {
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-fail",
      message:
        "AI 引擎目前無法完成助手請求（設定頁「AI 測試」成功仍可能失敗：助手需要較長對話與 JSON 工具協議）。 詳情：Cannot connect to host localhost:11434",
      toolCalls: [],
      error: "Cannot connect to host localhost:11434 ssl:default [遠端電腦拒絕網路連線。]",
    });

    const chat = await mount();
    await act(async () => {
      chat().setDraft("幫我填表");
    });
    await act(async () => {
      await chat().sendDraft();
    });

    expect(chat().messages).toEqual([]);
    expect(chat().draft).toBe("幫我填表");
    expect(chat().error).toContain("AI 引擎目前無法完成助手請求");
    expect(chat().sending).toBe(false);
  });

  it("maps Gemini MAX_TOKENS soft errors to zh-Hant copy instead of raw English", async () => {
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-gemini-cap",
      message: "",
      toolCalls: [],
      error: "Gemini response has no usable candidates (MAX_TOKENS)",
    });

    const chat = await mount();
    await act(async () => {
      chat().setDraft("今天有什麼行程");
    });
    await act(async () => {
      await chat().sendDraft();
    });

    expect(chat().messages).toEqual([]);
    expect(chat().error).toBe("Gemini 輸出因達到長度上限被截斷。請提高最大輸出 token，或縮短提示後重試。");
    expect(chat().error).not.toMatch(/MAX_TOKENS/);
    expect(chat().sending).toBe(false);
  });

  it("on task editor route with bridge, sends surface + currentTask and applies taskConfig", async () => {
    window.history.pushState({}, "", "/tasks/new");
    const applyTaskConfig = vi.fn();
    registerTaskEditorDraftBridge({
      getCurrentTask: () => ({
        name: "草稿任務",
        promptTemplate: "分析熱門話題",
        scheduleRrule: "FREQ=HOURLY",
        analysisMode: "leaderboard",
      }),
      applyTaskConfig,
    });
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-task-editor",
      message: "已幫你改名",
      toolCalls: [
        {
          name: "tasks.consult_advisor",
          arguments: { instruction: "改名" },
          resultSummary: "ok",
        },
      ],
      taskConfig: {
        name: "新任務名",
        promptTemplate: "分析熱門話題",
        scheduleRrule: "FREQ=HOURLY",
        analysisMode: "leaderboard",
        channelIds: [],
      },
    });

    const chat = await mount();
    await act(async () => {
      chat().setDraft("把名稱改成新任務名");
    });
    await act(async () => {
      await chat().sendDraft();
    });

    expect(mockStreamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        surface: "task_editor",
        currentTask: expect.objectContaining({ name: "草稿任務" }),
      }),
      expect.any(Object),
    );
    expect(applyTaskConfig).toHaveBeenCalledWith(
      expect.objectContaining({ name: "新任務名" }),
    );
  });

  it("on non-task routes does not send surface or currentTask", async () => {
    window.history.pushState({}, "", "/dashboard");
    registerTaskEditorDraftBridge({
      getCurrentTask: () => ({ name: "should-not-send" }),
      applyTaskConfig: vi.fn(),
    });
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-other",
      message: "ok",
      toolCalls: [],
    });

    const chat = await mount();
    await act(async () => {
      chat().setDraft("普通問題");
    });
    await act(async () => {
      await chat().sendDraft();
    });

    const body = mockStreamAgentChat.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(body.surface).toBeUndefined();
    expect(body.currentTask).toBeUndefined();
  });

  it("release-to-send uses STT text only — empty recognition does not send leftover draft", async () => {
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-voice",
      message: "ok",
      toolCalls: [],
    });
    const chat = await mount();
    await act(async () => {
      chat().setDraft("typed draft stays");
    });
    await act(async () => {
      await chat().startListening();
    });
    // Starting listen clears the prior composer draft so it is not shown as live STT.
    expect(chat().draft).toBe("");
    expect(chat().listening).toBe(true);

    await act(async () => {
      await chat().stopListening({ send: true });
    });

    expect(mockStreamAgentChat).not.toHaveBeenCalled();
    expect(chat().draft).toBe("");
    expect(chat().listening).toBe(false);
  });

  it("startListening clears leftover draft from the previous utterance", async () => {
    const ports = mockPorts();
    const chat = await mount();
    await act(async () => {
      chat().setDraft("1 2 3 4 5 3 4");
    });
    await act(async () => {
      await chat().startListening();
    });
    expect(chat().draft).toBe("");
    await act(async () => {
      ports.emit({ type: "partial", text: "新一句" });
    });
    expect(chat().draft).toBe("新一句");
  });

  it("release-to-send submits heard STT text and a second stop does not double-send", async () => {
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-voice-2",
      message: "ok",
      toolCalls: [],
    });
    const ports = mockPorts();
    const chat = await mount();

    await act(async () => {
      await chat().startListening();
    });
    await act(async () => {
      ports.emit({ type: "final", text: "語音內容" });
    });
    expect(chat().draft).toBe("語音內容");

    await act(async () => {
      const first = chat().stopListening({ send: true });
      const second = chat().stopListening({ send: true });
      await Promise.all([first, second]);
    });

    expect(mockStreamAgentChat).toHaveBeenCalledTimes(1);
    expect(mockStreamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "語音內容" }),
        ]),
      }),
      expect.any(Object),
    );
  });

  it("release-to-send uses draft when heardText was cleared but STT produced text", async () => {
    mockStreamAgentChat.mockResolvedValue({
      sessionId: "srv-voice-draft",
      message: "ok",
      toolCalls: [],
    });
    const ports = mockPorts();
    const chat = await mount();

    await act(async () => {
      await chat().startListening();
    });
    await act(async () => {
      ports.emit({ type: "partial", text: "1 2 3 4 5 3 4" });
    });
    expect(chat().draft).toBe("1 2 3 4 5 3 4");

    // Simulate teardown race: heard ref wiped while draft still holds STT.
    chat().heardTextRef.current = "";

    await act(async () => {
      await chat().stopListening({ send: true });
    });

    expect(mockStreamAgentChat).toHaveBeenCalledTimes(1);
    expect(mockStreamAgentChat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "user", content: "1 2 3 4 5 3 4" }),
        ]),
      }),
      expect.any(Object),
    );
  });

  it("short release during in-flight stt.start leaves listening false", async () => {
    let resolveStart: (() => void) | undefined;
    const ports = mockPorts();
    ports.stt.start = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveStart = resolve;
        }),
    );
    const chat = await mount();

    let startDone: Promise<void> | undefined;
    await act(async () => {
      startDone = chat().startListening();
    });
    expect(chat().listening).toBe(true);

    await act(async () => {
      await chat().stopListening({ send: true });
    });
    expect(chat().listening).toBe(false);

    await act(async () => {
      resolveStart?.();
      await startDone;
    });

    expect(chat().listening).toBe(false);
    expect(ports.stt.stop).toHaveBeenCalled();
  });
});
