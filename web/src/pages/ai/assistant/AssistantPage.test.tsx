import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

const { mockStreamAgentChat, mockCreateSpeechPorts } = vi.hoisted(() => ({
  mockStreamAgentChat: vi.fn(),
  mockCreateSpeechPorts: vi.fn(),
}));

vi.mock("../../../api/agent", () => ({
  streamAgentChat: mockStreamAgentChat,
  postAgentChat: vi.fn(),
}));

vi.mock("../../../api/tasks", () => ({
  listTasks: vi.fn(async () => []),
}));

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "running",
    aiEngineStatus: "available",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../../speech", async () => {
  const actual = await vi.importActual<typeof import("../../../speech")>("../../../speech");
  return {
    ...actual,
    createSpeechPorts: mockCreateSpeechPorts,
  };
});

import { AssistantPage } from "./AssistantPage";
import { AssistantChatProvider } from "../../../hooks/useAssistantChat";

function mockPorts(options?: { sttAvailable?: boolean; ttsAvailable?: boolean }) {
  const sttAvailable = options?.sttAvailable ?? false;
  const ttsAvailable = options?.ttsAvailable ?? false;
  const handlers = new Set<(ev: { type: string; text?: string; message?: string }) => void>();
  const stt = {
    providerId: "browser",
    isAvailable: () => sttAvailable,
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
      isAvailable: () => ttsAvailable,
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

describe("AssistantPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    setAppLocale("zh-Hant");
    void i18n.changeLanguage("zh-Hant");
    mockStreamAgentChat.mockReset();
    mockCreateSpeechPorts.mockReset();
    mockPorts({ sttAvailable: false, ttsAvailable: false });
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  async function renderPage() {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(
            MemoryRouter,
            null,
            createElement(AssistantChatProvider, null, createElement(AssistantPage)),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("renders text chat UI and hides mic when STT unavailable", async () => {
    await renderPage();

    expect(container.querySelector("[data-testid='assistant-page']")).toBeTruthy();
    expect(container.querySelector("[data-testid='assistant-draft']")).toBeTruthy();
    expect(container.querySelector("[data-testid='assistant-send']")).toBeTruthy();
    expect(container.querySelector("[data-testid='assistant-ptt']")).toBeNull();
    expect(container.textContent).toContain("問本機情報或日程");
    expect(container.textContent).toContain("此環境無法語音辨識，請改用文字輸入。");
  });

  it("puts chrome inside the card and omits OpsControlBar", async () => {
    await renderPage();

    expect(container.querySelector("[data-testid='assistant-card-header']")).toBeTruthy();
    expect(
      container.querySelector("[data-testid='assistant-card-header'] [data-testid='ai-staff-avatar-assistant']"),
    ).toBeTruthy();
    expect(container.querySelector(".im-control-bar")).toBeNull();
    expect(container.querySelector("[data-testid='assistant-card-header']")?.textContent).toContain(
      "助手",
    );
  });

  it("shows custom display name from identity storage in the card header", async () => {
    window.localStorage.setItem(
      "im:ai-staff:assistant:v1",
      JSON.stringify({ displayName: "測試助手", avatarDataUrl: null }),
    );
    await renderPage();
    expect(container.querySelector("[data-testid='assistant-card-header']")?.textContent).toContain(
      "測試助手",
    );
  });

  it("shows PTT when STT is available", async () => {
    mockPorts({ sttAvailable: true, ttsAvailable: true });
    await renderPage();
    expect(container.querySelector("[data-testid='assistant-ptt']")).toBeTruthy();
  });

  it("arms Space PTT when draft is unfocused and pauses while draft is focused", async () => {
    const { stt } = mockPorts({ sttAvailable: true, ttsAvailable: true });
    await renderPage();

    const draft = container.querySelector<HTMLTextAreaElement>("[data-testid='assistant-draft']");
    expect(draft).toBeTruthy();

    act(() => {
      draft!.focus();
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: " ", code: "Space" }),
      );
    });
    expect(stt.start).not.toHaveBeenCalled();

    act(() => {
      container
        .querySelector("[data-testid='assistant-messages']")!
        .dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    });
    expect(document.activeElement === draft).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: " ", code: "Space" }),
      );
    });
    expect(stt.start).toHaveBeenCalledTimes(1);
  });

  it("sends draft text and shows assistant reply with tool summary", async () => {
    mockStreamAgentChat.mockImplementation(async (_body, handlers) => {
      handlers?.onToolStart?.({
        type: "tool_start",
        name: "calendar.window",
        arguments: { start: "2026-07-19", end: "2026-07-26" },
      });
      handlers?.onToolDone?.({
        type: "tool_done",
        name: "calendar.window",
        arguments: { start: "2026-07-19", end: "2026-07-26" },
        resultSummary: "1 event in window",
      });
      return {
        message: "未來 7 天有 1 件家庭事務。",
        sessionId: "s1",
        toolCalls: [
          {
            name: "calendar.window",
            arguments: { start: "2026-07-19", end: "2026-07-26" },
            resultSummary: "1 event in window",
          },
        ],
      };
    });

    await renderPage();

    const draft = container.querySelector<HTMLTextAreaElement>("[data-testid='assistant-draft']");
    expect(draft).toBeTruthy();

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      )!.set!;
      setter.call(draft!, "最近一星期家庭事務？");
      draft!.dispatchEvent(new Event("input", { bubbles: true }));
      await Promise.resolve();
    });

    const send = container.querySelector<HTMLButtonElement>("[data-testid='assistant-send']");
    expect(send?.disabled).toBe(false);

    await act(async () => {
      send!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockStreamAgentChat).toHaveBeenCalledWith(
      {
        messages: [{ role: "user", content: "最近一星期家庭事務？" }],
        sessionId: undefined,
        locale: "zh-Hant",
        worksetId: "__user__",
      },
      expect.objectContaining({
        onToolStart: expect.any(Function),
        onToolDone: expect.any(Function),
      }),
    );
    expect(container.textContent).toContain("未來 7 天有 1 件家庭事務。");
    expect(container.textContent).toContain("calendar.window");
    expect(container.querySelector("[data-testid='assistant-tool-summary']")).toBeTruthy();
  });
});
