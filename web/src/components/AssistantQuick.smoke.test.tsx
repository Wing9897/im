import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MonitorModeProvider } from "../context/MonitorModeContext";
import { AssistantQuickProvider } from "../hooks/useAssistantQuick";
import { AssistantChatProvider } from "../hooks/useAssistantChat";
import { AssistantQuickTrigger } from "./AssistantQuickTrigger";
import { AssistantQuickDialog } from "./AssistantQuickDialog";

vi.mock("../hooks/useErrorToast", () => ({
  useErrorToast: () => {},
}));

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock(),
);

const startListening = vi.fn(async () => {});
const stopListening = vi.fn(async () => {});
const clearChat = vi.fn();
const stopSpeaking = vi.fn();
const chatMock = {
  messages: [] as { id: string; role: "user" | "assistant"; content: string }[],
  draft: "",
  setDraft: vi.fn(),
  sending: false,
  liveToolSteps: [] as unknown[],
  listening: false,
  speaking: false,
  error: null as string | null,
  sttAvailable: true,
  ttsAvailable: false,
  ttsEnabled: false,
  spacePttMode: "hold" as const,
  worksetId: "__general__",
  setWorksetId: vi.fn(),
  sendDraft: vi.fn(),
  startListening,
  stopListening,
  stopSpeaking,
  clearChat,
};

vi.mock("../api/tasks", () => ({
  listTasks: vi.fn(async () => []),
}));

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../hooks/useAssistantChat", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../hooks/useAssistantChat")>();
  return {
    ...actual,
    useAssistantChatHost: () => chatMock,
    useAssistantChat: () => chatMock,
  };
});

describe("AssistantQuick smoke", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    startListening.mockClear();
    stopListening.mockClear();
    clearChat.mockClear();
    stopSpeaking.mockClear();
    chatMock.messages = [];
    chatMock.draft = "";
    chatMock.sending = false;
    chatMock.listening = false;
    chatMock.speaking = false;
    chatMock.sttAvailable = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    document
      .querySelectorAll("[data-testid='assistant-direct-bubbles']")
      .forEach((el) => el.remove());
  });

  function renderQuick() {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(
              AssistantChatProvider,
              null,
              createElement(
                AssistantQuickProvider,
                null,
                createElement(AssistantQuickTrigger, { compact: true }),
                createElement(AssistantQuickDialog),
              ),
            ),
          ),
        ),
      );
    });
  }

  function openComposerViaChrome() {
    const btn = container.querySelector(
      '[data-testid="assistant-chrome-composer"]',
    ) as HTMLButtonElement;
    act(() => {
      btn.click();
    });
  }

  function dispatchKey(
    type: "keydown" | "keyup",
    init: KeyboardEventInit,
    target: EventTarget = window,
  ) {
    const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  it("arms global voice by default without a mode toggle or composer", () => {
    renderQuick();

    expect(document.querySelector('[data-testid="assistant-quick-trigger"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-quick-dialog"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-caption-composer"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-direct-bubbles"]')).not.toBeNull();

    expect(container.querySelector('[data-testid="assistant-chrome-clear"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-caption-clear"]')).toBeNull();
  });

  it("does not flash prior session turns when voice arms", () => {
    chatMock.messages = [
      { id: "u-old", role: "user", content: "previous ask" },
      { id: "a-old", role: "assistant", content: "previous reply" },
    ];
    renderQuick();
    expect(document.querySelector('[data-testid="assistant-direct-msg"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-direct-user-msg"]')).toBeNull();
    // Ready hint is fine; prior transcript must stay hidden.
    expect(document.querySelector('[data-testid="assistant-direct-ready"]')).not.toBeNull();
  });

  it("opens text composer via chrome or Ctrl/Meta+J; Esc closes composer only", () => {
    renderQuick();
    expect(document.querySelector('[data-testid="assistant-caption-composer"]')).toBeNull();

    openComposerViaChrome();
    expect(document.querySelector('[data-testid="assistant-caption-composer"]')).not.toBeNull();
    const presence = document.querySelector('[data-testid="assistant-direct-presence"]');
    expect(presence).not.toBeNull();
    expect(presence?.querySelector('[data-testid="ai-staff-avatar-assistant"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="assistant-task-advisor-presence"]')).toBeNull();

    dispatchKey("keydown", { key: "Escape" });
    expect(document.querySelector('[data-testid="assistant-caption-composer"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-direct-presence"]')).toBeNull();
    // Idle voice keeps working even if the bubble portal has nothing to show.
    startListening.mockClear();
    const voiceDown = dispatchKey("keydown", { key: " ", code: "Space" });
    expect(voiceDown.defaultPrevented).toBe(true);
    expect(startListening).toHaveBeenCalledTimes(1);
    dispatchKey("keyup", { key: " ", code: "Space" });

    dispatchKey("keydown", { key: "j", ctrlKey: true });
    expect(document.querySelector('[data-testid="assistant-caption-composer"]')).not.toBeNull();

    dispatchKey("keydown", { key: "j", metaKey: true });
    expect(document.querySelector('[data-testid="assistant-caption-composer"]')).toBeNull();
  });

  it("keeps Space PTT while composer is open until the draft is focused", () => {
    renderQuick();

    const down = dispatchKey("keydown", { key: " ", code: "Space" });
    expect(down.defaultPrevented).toBe(true);
    expect(startListening).toHaveBeenCalledTimes(1);
    dispatchKey("keyup", { key: " ", code: "Space" });
    expect(stopListening).toHaveBeenCalled();

    startListening.mockClear();
    stopListening.mockClear();
    openComposerViaChrome();

    // Composer stays visible but does not steal focus — Space still talks.
    const openDown = dispatchKey("keydown", { key: " ", code: "Space" });
    expect(openDown.defaultPrevented).toBe(true);
    expect(startListening).toHaveBeenCalledTimes(1);
    dispatchKey("keyup", { key: " ", code: "Space" });

    const draft = document.querySelector(
      '[data-testid="assistant-caption-draft"]',
    ) as HTMLTextAreaElement;
    expect(draft).not.toBeNull();
    act(() => {
      draft.focus();
    });
    startListening.mockClear();

    const focusedDown = dispatchKey("keydown", { key: " ", code: "Space" }, draft);
    expect(focusedDown.defaultPrevented).toBe(false);
    expect(startListening).not.toHaveBeenCalled();
  });

  it("toggles composer history next to send", () => {
    chatMock.messages = [
      { id: "u1", role: "user", content: "hello history" },
      { id: "a1", role: "assistant", content: "hi back" },
    ];
    renderQuick();
    openComposerViaChrome();

    expect(document.querySelector('[data-testid="assistant-caption-history"]')).toBeNull();
    const toggle = document.querySelector(
      '[data-testid="assistant-caption-history-toggle"]',
    ) as HTMLButtonElement;
    expect(toggle).not.toBeNull();

    act(() => {
      toggle.click();
    });
    const history = document.querySelector('[data-testid="assistant-caption-history"]');
    expect(history).not.toBeNull();
    expect(history?.className).toContain("im-auto-scrollbar");
    expect(history?.textContent).toContain("hello history");
    expect(history?.textContent).toContain("hi back");

    act(() => {
      toggle.click();
    });
    expect(document.querySelector('[data-testid="assistant-caption-history"]')).toBeNull();
  });

  it("does not arm Space PTT or ready hint when STT is unavailable", () => {
    chatMock.sttAvailable = false;
    renderQuick();
    expect(document.querySelector('[data-testid="assistant-direct-ready"]')).toBeNull();

    const down = dispatchKey("keydown", { key: " ", code: "Space" });
    expect(down.defaultPrevented).toBe(false);
    expect(startListening).not.toHaveBeenCalled();

    const composerBtn = container.querySelector(
      '[data-testid="assistant-chrome-composer"]',
    ) as HTMLButtonElement;
    expect(composerBtn.getAttribute("data-stt-available")).toBe("false");

    openComposerViaChrome();
    expect(document.querySelector('[data-testid="assistant-caption-ptt"]')).toBeNull();
  });

  it("shows composer mic when STT is available and arms PTT while draft is focused", () => {
    renderQuick();
    openComposerViaChrome();

    const mic = document.querySelector(
      '[data-testid="assistant-caption-ptt"]',
    ) as HTMLButtonElement;
    expect(mic).not.toBeNull();

    const draft = document.querySelector(
      '[data-testid="assistant-caption-draft"]',
    ) as HTMLTextAreaElement;
    act(() => {
      draft.focus();
    });
    startListening.mockClear();
    stopListening.mockClear();

    // Space stays paused while typing…
    const focusedDown = dispatchKey("keydown", { key: " ", code: "Space" }, draft);
    expect(focusedDown.defaultPrevented).toBe(false);
    expect(startListening).not.toHaveBeenCalled();

    // …but mic PTT still works (hold → listen, release → send).
    // jsdom lacks PointerEvent; MouseEvent is enough for React pointer handlers.
    mic.setPointerCapture = () => {};
    mic.releasePointerCapture = () => {};
    act(() => {
      mic.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    expect(startListening).toHaveBeenCalledTimes(1);

    act(() => {
      mic.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
    });
    act(() => {
      mic.dispatchEvent(new Event("lostpointercapture", { bubbles: true }));
    });
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("keeps mic listening when draft gains focus (Space pause only)", () => {
    renderQuick();
    openComposerViaChrome();

    // Start mic while draft is unfocused (Space still live).
    const mic = document.querySelector(
      '[data-testid="assistant-caption-ptt"]',
    ) as HTMLButtonElement;
    mic.setPointerCapture = () => {};
    mic.releasePointerCapture = () => {};
    act(() => {
      mic.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    });
    expect(startListening).toHaveBeenCalledTimes(1);

    chatMock.listening = true;
    renderQuick();
    stopListening.mockClear();

    const draft = document.querySelector(
      '[data-testid="assistant-caption-draft"]',
    ) as HTMLTextAreaElement;
    act(() => {
      draft.focus();
    });

    // Focusing must not kill mic-owned listen (legacy voiceLive effect bug).
    expect(stopListening).not.toHaveBeenCalled();
  });

  it("hides composer mic when STT becomes unavailable", () => {
    renderQuick();
    openComposerViaChrome();
    expect(document.querySelector('[data-testid="assistant-caption-ptt"]')).not.toBeNull();

    chatMock.sttAvailable = false;
    renderQuick();
    openComposerViaChrome();
    expect(document.querySelector('[data-testid="assistant-caption-ptt"]')).toBeNull();
  });

  it("pauses Space PTT when focus enters a page input", () => {
    renderQuick();
    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      input.focus();
    });
    startListening.mockClear();

    const down = dispatchKey("keydown", { key: " ", code: "Space" }, input);
    expect(down.defaultPrevented).toBe(false);
    expect(startListening).not.toHaveBeenCalled();

    act(() => {
      input.blur();
      document.body.focus();
    });
    // Ensure focus left the editable (jsdom may keep body non-editable).
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur?.();
    });

    document.body.removeChild(input);
  });

  it("lets Space type in the composer (no PTT while text mode is open)", () => {
    renderQuick();
    openComposerViaChrome();
    const draft = document.querySelector(
      '[data-testid="assistant-caption-draft"]',
    ) as HTMLTextAreaElement;
    expect(draft).not.toBeNull();
    act(() => {
      draft.focus();
    });
    startListening.mockClear();
    const down = dispatchKey("keydown", { key: " ", code: "Space" }, draft);
    expect(down.defaultPrevented).toBe(false);
    expect(startListening).not.toHaveBeenCalled();
  });

  it("places clear chat next to the composer input only", () => {
    chatMock.messages = [{ id: "u1", role: "user", content: "hi" }];
    renderQuick();
    expect(container.querySelector('[data-testid="assistant-chrome-clear"]')).toBeNull();
    expect(document.querySelector('[data-testid="assistant-caption-clear"]')).toBeNull();

    openComposerViaChrome();
    const clearBtn = document.querySelector(
      '[data-testid="assistant-caption-clear"]',
    ) as HTMLButtonElement;
    const draft = document.querySelector('[data-testid="assistant-caption-draft"]');
    expect(clearBtn).not.toBeNull();
    expect(clearBtn.disabled).toBe(false);
    expect(draft).not.toBeNull();
    expect(draft!.compareDocumentPosition(clearBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(clearBtn.closest('[data-testid="assistant-caption-composer"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="assistant-chrome"]')?.contains(clearBtn),
    ).toBe(false);

    act(() => {
      clearBtn.click();
    });
    expect(clearChat).toHaveBeenCalledTimes(1);
  });

  it("shows chrome stop-speaking only while speaking", () => {
    renderQuick();
    expect(
      container.querySelector('[data-testid="assistant-chrome-stop-speaking"]'),
    ).toBeNull();

    chatMock.speaking = true;
    renderQuick();

    const stopBtn = container.querySelector(
      '[data-testid="assistant-chrome-stop-speaking"]',
    ) as HTMLButtonElement;
    expect(stopBtn).not.toBeNull();

    act(() => {
      stopBtn.click();
    });
    expect(stopSpeaking).toHaveBeenCalledTimes(1);
  });

  it("orders chrome actions without a mode-toggle button", () => {
    renderQuick();
    const chrome = container.querySelector('[data-testid="assistant-chrome"]')!;
    const ids = [...chrome.querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(ids).toEqual([
      "assistant-chrome-composer",
    ]);
  });
});
