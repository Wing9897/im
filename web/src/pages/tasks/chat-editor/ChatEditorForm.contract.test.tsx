/**
 * Task form for create/edit — two-column on md+; tall fields span full width.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM_STATE } from "../../../hooks/useTaskEditorState";
import { ChatEditorForm } from "./ChatEditorForm";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../../test/i18nHarness";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../../api/llmProfiles", () => ({
  listLlmProfiles: vi.fn(async () => [
    {
      id: "profile-default",
      name: "Default",
      provider: "openai_compatible",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-test",
      apiKey: "********",
      thinkingEnabled: false,
      jsonMode: "disabled",
      webSearchEnabled: true,
      webSearchProvider: "auto",
      braveSearchApiKey: "",
      isDefault: true,
      staffClasses: [],
      staffInstances: [],
      createdAt: null,
      updatedAt: null,
    },
  ]),
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  await ensureZhHantLocale();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ChatEditorForm analysis-task contract", () => {
  it.each(["leaderboard", "intel_event", "agent"] as const)(
    "does not show calendar recurrence controls in %s mode",
    async (analysisMode) => {
      const helperCopy = String(i18n.t("tasks.editor.rruleHint"));
      await act(async () => {
        root.render(
          wrapWithI18n(createElement(ChatEditorForm, {
              formState: { ...DEFAULT_FORM_STATE, analysisMode },
              updateField: () => undefined,
              channels: [],
              onOpenChannelDialog: () => undefined,
            })),
        );
        await Promise.resolve();
      });
      expect(container.querySelector('[role="note"]')).toBeNull();
      expect(container.textContent).not.toContain(helperCopy);
      expect(container.textContent).not.toContain("重複規則");
      expect(container.querySelector('[aria-label="排程類型"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="進階設定"]')).not.toBeNull();
    },
  );

  it("shows agent optional channels and timed-mode hint (no seed query)", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "schedule",
              outputCalendar: false,
              outputAnalysisEvents: true,
              scheduleType: "hourly",
              promptTemplate: "",
              channelIds: [],
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
    });
    expect(container.querySelector('[data-testid="task-web-search-query"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-agent-schedule-hint"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-prompt-required"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-channel-hint"]')).not.toBeNull();
    expect(container.textContent).toContain("純定時");
    expect(container.textContent).toContain("來源頻道（選填）");
    expect(container.querySelector('[aria-label="選擇分析來源頻道"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-schedule-overrides"]')).toBeNull();
  });

  it("shows agent message-gate overrides when channels are bound", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "message_threshold",
              outputCalendar: false,
              outputAnalysisEvents: true,
              scheduleType: "hourly",
              promptTemplate: "Gather intel",
              channelIds: ["ch-1"],
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
    });
    expect(container.querySelector('[data-testid="task-agent-channel-hint"]')?.textContent).toContain(
      "訊息閾值",
    );
    // Message-gate auto-expands Advanced so threshold overrides are reachable.
    expect(container.querySelector('[data-testid="task-schedule-overrides"]')).not.toBeNull();
  });

  it("shows project wave interval after schedule type in agent cursor mode", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "message_cursor",
              outputCalendar: true,
              outputAnalysisEvents: false,
              scheduleType: "hourly",
              agentWaveIntervalSeconds: 20,
              channelIds: ["ch-1"],
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
    });
    expect(container.querySelector('[data-testid="schedule-project-wave-interval"]')).not.toBeNull();
    expect(container.textContent).toContain("Agent 波間間隔");
  });

  it("binds project wave interval to form state instead of system settings", async () => {
    const updateField = vi.fn();
    await act(async () => {
      root.render(
        wrapWithI18n(createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "message_cursor",
              outputCalendar: true,
              outputAnalysisEvents: false,
              scheduleType: "hourly",
              agentWaveIntervalSeconds: 15,
              channelIds: ["ch-1"],
            },
            updateField,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
    });
    const input = container.querySelector(
      '[data-testid="schedule-project-wave-interval"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("15");
    expect(container.textContent).toContain("儲存在本任務");
  });
});
