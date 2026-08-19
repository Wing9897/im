import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const {
  mockStreamAgentChat,
  mockCreateSpeechPorts,
  mockListLlmProfiles,
  mockListLlmGlobalSlots,
} = vi.hoisted(() => ({
  mockStreamAgentChat: vi.fn(),
  mockCreateSpeechPorts: vi.fn(),
  mockListLlmProfiles: vi.fn(),
  mockListLlmGlobalSlots: vi.fn(),
}));

const boundAssistantSlots = [
  {
    slot: "assistant" as const,
    profileId: "profile-default",
    profileName: "Default",
    profileProvider: "ollama",
    profileModel: "llama3",
  },
  {
    slot: "liaison" as const,
    profileId: null,
    profileName: null,
    profileProvider: null,
    profileModel: null,
  },
  {
    slot: "taskEditor" as const,
    profileId: null,
    profileName: null,
    profileProvider: null,
    profileModel: null,
  },
];

const defaultProfile = {
  id: "profile-default",
  name: "Default",
  provider: "ollama",
  baseUrl: "http://localhost:11434",
  model: "llama3",
  apiKey: "",
  thinkingEnabled: false,
  jsonMode: "disabled",
  webSearchEnabled: true,
  webSearchProvider: "auto",
  braveSearchApiKey: "",
  staffClasses: [],
  staffInstances: [],
  createdAt: null,
  updatedAt: null,
};

vi.mock("../../../api/agent", () => ({
  streamAgentChat: mockStreamAgentChat,
  postAgentChat: vi.fn(),
}));

vi.mock("../../../api/llmProfiles", () => ({
  listLlmProfiles: mockListLlmProfiles,
  listLlmGlobalSlots: mockListLlmGlobalSlots,
}));

vi.mock("../../../api/tasks", () => ({
  listTasks: vi.fn(async () => []),
}));

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

const collectorStatusState = vi.hoisted(() => ({
  collectorStatus: "running" as string,
  aiEngineStatus: "available" as string,
  requestAiStatusRefresh: vi.fn(),
}));

vi.mock("../../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => collectorStatusState,
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

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    await ensureZhHantLocale();
    mockStreamAgentChat.mockReset();
    mockCreateSpeechPorts.mockReset();
    mockListLlmProfiles.mockReset();
    mockListLlmGlobalSlots.mockReset();
    mockListLlmProfiles.mockResolvedValue([defaultProfile]);
    mockListLlmGlobalSlots.mockResolvedValue(boundAssistantSlots);
    collectorStatusState.collectorStatus = "running";
    collectorStatusState.aiEngineStatus = "available";
    collectorStatusState.requestAiStatusRefresh.mockReset();
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
        wrapWithI18n(createElement(
            MemoryRouter,
            null,
            createElement(AssistantChatProvider, null, createElement(AssistantPage)),
          )),
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
    expect(container.textContent).toContain("問本機情報、日程或物品");
    expect(container.textContent).toContain("此環境無法語音辨識，請改用文字輸入。");
  });

  it("links to AI provider settings when the engine is unavailable", async () => {
    collectorStatusState.aiEngineStatus = "unavailable";
    await renderPage();

    const banner = container.querySelector("[data-testid='assistant-ai-unavailable']");
    expect(banner).toBeTruthy();
    const link = container.querySelector(
      "[data-testid='assistant-ai-settings-link']",
    ) as HTMLAnchorElement | null;
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/ai/provider");
  });

  it("keeps composer usable and has no dedicated LLM profile section", async () => {
    await renderPage();

    expect(container.querySelector("[data-testid='assistant-draft']")).toBeTruthy();
    expect(container.querySelector("[data-testid='assistant-llm-profile']")).toBeNull();
    expect(container.querySelector("[data-testid='assistant-llm-profile-unbound']")).toBeNull();
    expect(container.querySelector("[data-testid='assistant-session-llm-profile']")).toBeNull();
    expect(container.textContent).not.toContain("LLM 設定檔");
    expect(container.textContent).not.toContain("前往 AI 設定檔");
    expect(container.textContent).not.toContain("跟隨助手槽位");
  });

  it("shows a short unbound-slot banner linking to AI settings", async () => {
    mockListLlmGlobalSlots.mockResolvedValue(
      boundAssistantSlots.map((row) =>
        row.slot === "assistant" ? { ...row, profileId: null } : row,
      ),
    );

    await renderPage();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const banner = container.querySelector("[data-testid='assistant-slot-unbound']");
    expect(banner).toBeTruthy();
    const link = container.querySelector(
      "[data-testid='assistant-slot-settings-link']",
    ) as HTMLAnchorElement | null;
    expect(link?.getAttribute("href")).toBe("/ai/provider");
    expect(container.querySelector("[data-testid='assistant-draft']")).toBeTruthy();
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
        worksetId: "__general__",
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
