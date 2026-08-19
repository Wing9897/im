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
      const helperCopy = String(i18n.t("tasks:editor.rruleHint"));
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
      const output = container.querySelector('[data-testid="task-output-fields"]');
      expect(output).not.toBeNull();
      expect(output?.querySelector('[data-testid="notify-pref-field"]')).not.toBeNull();
      if (analysisMode === "leaderboard") {
        expect(output?.querySelector('[data-testid="task-output-analysis-events"]')).toBeNull();
      } else {
        expect(output?.querySelector('[data-testid="task-output-analysis-events"]')).not.toBeNull();
      }
      expect(container.querySelector('[data-testid="task-agent-output-analysis"]')).toBeNull();
      if (analysisMode === "agent") {
        expect(output?.querySelector('[data-testid="task-agent-output-calendar"]')).not.toBeNull();
      } else {
        expect(output?.querySelector('[data-testid="task-agent-output-calendar"]')).toBeNull();
      }
      const optional = container.querySelector('[aria-label="進階設定"]');
      expect(optional?.querySelector('[data-testid="notify-pref-field"]')).toBeNull();
      expect(optional?.querySelector('[data-testid="task-include-in-timeline"]')).toBeNull();
      if (analysisMode === "leaderboard") {
        expect(output?.querySelector('[data-testid="task-include-in-timeline"]')).toBeNull();
      } else {
        expect(output?.querySelector('[data-testid="task-include-in-timeline"]')).not.toBeNull();
      }
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
    const output = container.querySelector('[data-testid="task-output-fields"]');
    expect(output?.querySelector('[data-testid="task-agent-output-calendar"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-policy"] [data-testid="task-agent-output-calendar"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-agent-output-analysis"]')).toBeNull();
    expect(output).not.toBeNull();
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

  it("keeps description and wave interval under Advanced", async () => {
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
              description: "進階描述",
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
    });
    const advanced = container.querySelector('[aria-label="進階設定"]');
    expect(advanced).not.toBeNull();
    expect(advanced?.querySelector("#chat-task-description")).not.toBeNull();
    expect(advanced?.querySelector('[data-testid="schedule-project-wave-interval"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="task-editor-step-when"] #chat-task-description'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="task-editor-step-scope"] #chat-task-description'),
    ).toBeNull();
    expect(container.querySelector('[data-testid="task-agent-trigger"]')?.getAttribute("role")).toBe(
      "radiogroup",
    );
  });

  it("shows four numbered sections on one scroll with required asterisks", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "intel_event",
              promptTemplate: "",
              channelIds: [],
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
      await Promise.resolve();
    });

    const identity = container.querySelector('[data-testid="task-editor-step-identity"]');
    const scope = container.querySelector('[data-testid="task-editor-step-scope"]');
    const when = container.querySelector('[data-testid="task-editor-step-when"]');
    const output = container.querySelector('[data-testid="task-editor-step-output"]');
    expect(identity).not.toBeNull();
    expect(scope).not.toBeNull();
    expect(when).not.toBeNull();
    expect(output).not.toBeNull();
    expect(identity?.textContent).toContain("這是什麼");
    expect(scope?.textContent).toContain("看什麼");
    expect(when?.textContent).toContain("何時跑");
    expect(output?.textContent).toContain("產出到哪");
    expect(container.querySelector('[data-testid="setup-step-indicator"]')).toBeNull();

    const nameLabel = container.querySelector('label[for="chat-task-name"]');
    expect(nameLabel?.textContent).toMatch(/任務名稱\s*\*/);
    expect(container.querySelector('[data-testid="task-employee-picker"] label')?.textContent).toMatch(
      /任務類型\s*\*/,
    );
    expect(container.querySelector('label[for="chat-llm-profile"]')?.textContent).toMatch(
      /LLM 設定檔\s*\*/,
    );
    expect(scope?.querySelector("label")?.textContent).toMatch(/分析來源頻道\s*\*/);
    expect(container.querySelector('label[for="chat-prompt-template"]')?.textContent).toMatch(/\*/);
    expect(container.querySelector('label[for="chat-prompt-template"]')?.textContent).not.toContain(
      "必填",
    );
    expect(when?.querySelector('[aria-label="排程類型"]')).not.toBeNull();
    expect(scope?.querySelector('[data-testid="task-prompt-template"]')).not.toBeNull();
    expect(identity?.querySelector('[data-testid="task-prompt-template"]')).toBeNull();
  });

  it("does not mark optional agent channels as required", async () => {
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
              promptTemplate: "Gather intel",
              channelIds: [],
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          })),
      );
    });
    const scope = container.querySelector('[data-testid="task-editor-step-scope"]');
    expect(scope?.textContent).toContain("來源頻道（選填）");
    expect(scope?.querySelector("label")?.textContent).not.toMatch(/\*/);
    expect(container.querySelector('[data-testid="task-editor-step-when"] [data-testid="task-agent-trigger"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-editor-step-output"] [data-testid="task-agent-policy"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-editor-step-when"] [data-testid="task-agent-policy"]')).toBeNull();
  });
});
