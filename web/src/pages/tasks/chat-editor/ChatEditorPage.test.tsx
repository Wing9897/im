import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listTaskTemplatePresetsMock, mockUseChatEditor } = vi.hoisted(() => ({
  listTaskTemplatePresetsMock: vi.fn(),
  mockUseChatEditor: vi.fn(),
}));

vi.mock("../../../api/tasks", () => ({
  listTaskTemplatePresets: (...args: unknown[]) => listTaskTemplatePresetsMock(...args),
}));

vi.mock("./useChatEditor", () => ({
  useChatEditor: mockUseChatEditor,
}));

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../../components/task/TaskTemplatePresetDialog", () => ({
  TaskTemplatePresetDialog: (props: {
    onApply: () => void;
    onClose: () => void;
    presets: unknown[];
    selectedPresetId: string;
    setSelectedPresetId: (id: string) => void;
  }) =>
    createElement(
      "div",
      { "data-testid": "preset-dialog" },
      createElement(
        "button",
        {
          "data-testid": "preset-dialog-apply",
          onClick: props.onApply,
        },
        "Apply Preset",
      ),
      createElement(
        "button",
        {
          "data-testid": "preset-dialog-close",
          onClick: props.onClose,
        },
        "Close",
      ),
    ),
}));

import { ChatEditorPage } from "./ChatEditorPage";
import { DEFAULT_FORM_STATE } from "../../../hooks/useTaskEditorState";
import type { TaskFormState, UseChatEditorReturn } from "./useChatEditor";

/** Leaderboard surface for channel/preset UI (SoT default is recurring). */
const ANALYSIS_FORM_STATE: TaskFormState = {
  ...DEFAULT_FORM_STATE,
  analysisMode: "leaderboard",
};

function createMockHookReturn(overrides: Partial<UseChatEditorReturn> = {}): UseChatEditorReturn {
  return {
    formState: ANALYSIS_FORM_STATE,
    updateField: vi.fn(),
    error: null,
    save: vi.fn().mockResolvedValue(undefined),
    canSave: false,
    saveBlockReason: null,
    isSaving: false,
    scheduleHydrating: false,
    scheduleHydrateError: null,
    retryScheduleHydrate: vi.fn(),
    applyPreset: vi.fn(),
    channels: [],
    ...overrides,
  };
}

function renderPage(route = "/tasks/new") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: [route] },
        createElement(
          Routes,
          null,
          createElement(Route, {
            path: "/tasks/new",
            element: createElement(ChatEditorPage),
          }),
          createElement(Route, {
            path: "/tasks/:taskId/edit",
            element: createElement(ChatEditorPage),
          }),
        ),
      ),
    );
  });
  return {
    container,
    root: root!,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("ChatEditorPage integration tests", () => {
  beforeEach(() => {
    listTaskTemplatePresetsMock.mockReset();
    mockUseChatEditor.mockReset();
    window.localStorage.clear();

    listTaskTemplatePresetsMock.mockResolvedValue([
      {
        id: "preset-1",
        name: "熱門話題追蹤",
        description: "追蹤群組中的熱門話題",
        analysisMode: "leaderboard",
        promptTemplate: "分析以下訊息中的熱門話題",
        webSearchQuery: "",
        defaultAnalysisTimeRange: "1d",
        badge: "🔥",
      },
    ]);

    mockUseChatEditor.mockReturnValue(createMockHookReturn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("workset deep-link", () => {
    it("applies worksetId from /tasks/new query on create", async () => {
      const updateField = vi.fn();
      mockUseChatEditor.mockReturnValue(createMockHookReturn({ updateField }));

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage("/tasks/new?worksetId=ws-ops");
        await Promise.resolve();
      });
      const { cleanup } = result!;
      expect(updateField).toHaveBeenCalledWith("worksetId", "ws-ops");
      cleanup();
    });
  });

  describe("renders form (no page advisor chat)", () => {
    it("renders two-column form and does not mount advisor sheet", async () => {
      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[data-testid="task-editor-form"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="task-advisor-sheet"]')).toBeNull();
      expect(container.querySelector('section[aria-label="AI 對話"]')).toBeNull();
      expect(
        container.querySelector('textarea[placeholder="描述你想建立的任務..."]'),
      ).toBeNull();

      cleanup();
    });

    it("displays the task form section with aria-label", async () => {
      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[aria-label="必填欄位"]')).not.toBeNull();

      cleanup();
    });

    it("displays form fields: name, description, prompt, schedule, analysis mode", async () => {
      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.textContent).toContain("任務名稱");
      expect(container.textContent).toContain("描述");
      expect(container.textContent).toContain("Task Prompt");
      expect(container.textContent).toContain("排程類型");
      expect(container.textContent).toContain("任務類型");
      expect(container.textContent).toContain("基本設定");
      expect(container.textContent).toContain("設定／技能");
      expect(container.querySelector('[data-testid="task-prompt-template"]')).not.toBeNull();

      cleanup();
    });

    it("displays the channel picker button without per-task batch limit field", async () => {
      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const channelBtn = container.querySelector(
        '[data-testid="channel-picker-button"]',
      ) as HTMLButtonElement;
      expect(channelBtn).not.toBeNull();
      expect(channelBtn.textContent).toContain("點擊選擇頻道");
      expect(container.querySelector('input[aria-label="批次訊息上限"]')).toBeNull();

      cleanup();
    });

    it("shows selected channel count when channels are selected", async () => {
      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          formState: {
            ...ANALYSIS_FORM_STATE,
            channelIds: ["ch-1", "ch-2"],
          },
          channels: [
            {
              id: "ch-1",
              platform: "telegram",
              platformChannelId: "p1",
              channelName: "Channel One",
              accountId: "acc-1",
              accountName: "User",
            },
            {
              id: "ch-2",
              platform: "discord",
              platformChannelId: "p2",
              channelName: "Channel Two",
              accountId: "acc-2",
              accountName: "User 2",
            },
          ],
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const channelBtn = container.querySelector(
        '[data-testid="channel-picker-button"]',
      ) as HTMLButtonElement;
      expect(channelBtn.textContent).toContain("已選 2 / 2");
      expect(container.textContent).toContain("Channel One");
      expect(container.textContent).toContain("Channel Two");

      cleanup();
    });

    it("renders toolbar aligned to the form column (max-w-5xl)", async () => {
      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const toolbar = container.querySelector('[data-testid="task-editor-toolbar"]');
      expect(toolbar).not.toBeNull();
      const row = toolbar!.firstElementChild as HTMLElement;
      expect(row.className).toContain("max-w-5xl");
      expect(row.className).not.toContain("max-w-[720px]");
      expect(container.textContent).toContain("新增任務");
      expect(container.querySelector('[data-testid="preset-button"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="task-editor-save"]')).not.toBeNull();

      cleanup();
    });

    it("shows preset button in create mode", async () => {
      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[data-testid="preset-button"]')).not.toBeNull();

      cleanup();
    });

    it("hides preset button for recurring mode", async () => {
      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          formState: { ...createMockHookReturn().formState, analysisMode: "recurring" },
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[data-testid="preset-button"]')).toBeNull();
      cleanup();
    });

    it("shows preset button for project mode", async () => {
      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          formState: {
            ...createMockHookReturn().formState,
            analysisMode: "project",
            scheduleType: "hourly",
          },
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[data-testid="preset-button"]')).not.toBeNull();
      cleanup();
    });

    it("surfaces persistence error from the hook", async () => {
      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({ error: "儲存失敗" }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[role="alert"]')?.textContent).toContain("儲存失敗");

      cleanup();
    });
  });

  describe("preset application populates form", () => {
    it("applies preset values to form fields", async () => {
      const applyPresetMock = vi.fn();
      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          applyPreset: applyPresetMock,
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage();
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const presetBtn = container.querySelector(
        '[data-testid="preset-button"]',
      ) as HTMLButtonElement;
      await act(async () => {
        presetBtn.click();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(container.querySelector('[data-testid="preset-dialog"]')).not.toBeNull();

      const applyBtn = container.querySelector(
        '[data-testid="preset-dialog-apply"]',
      ) as HTMLButtonElement;
      await act(async () => {
        applyBtn.click();
        await Promise.resolve();
      });

      expect(applyPresetMock).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "preset-1",
          name: "熱門話題追蹤",
          description: "追蹤群組中的熱門話題",
          analysisMode: "leaderboard",
          promptTemplate: "分析以下訊息中的熱門話題",
        }),
      );

      cleanup();
    });

    it("preset button is hidden in edit mode", async () => {
      mockUseChatEditor.mockReturnValue(createMockHookReturn());

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage("/tasks/task-123/edit");
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      expect(container.querySelector('[data-testid="preset-button"]')).toBeNull();

      cleanup();
    });
  });

  describe("edit mode pre-populates form from existing task", () => {
    it("loads existing task data and populates form fields", async () => {
      const existingTaskFormState: TaskFormState = {
        ...DEFAULT_FORM_STATE,
        name: "Existing Task",
        description: "Existing description",
        promptTemplate: "Existing prompt template",
        scheduleType: "daily",
        scheduleValue: "09:00",
        scheduleRrule: "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
        analysisMode: "intel_event",
        analysisTimeRange: "7d",
        channelIds: ["ch-1", "ch-2"],
      };

      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          formState: existingTaskFormState,
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage("/tasks/task-123/edit");
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const nameInput = container.querySelector(
        'input[placeholder="輸入任務名稱"]',
      ) as HTMLInputElement;
      expect(nameInput.value).toBe("Existing Task");

      const descInput = container.querySelector(
        'input[placeholder="任務描述（選填）"]',
      ) as HTMLInputElement;
      expect(descInput.value).toBe("Existing description");

      const promptTextarea = container.querySelector(
        '[data-testid="task-prompt-template"]',
      ) as HTMLTextAreaElement;
      expect(promptTextarea.value).toBe("Existing prompt template");

      expect(container.textContent).toContain("編輯任務");
      expect(container.querySelector('[data-testid="preset-button"]')).toBeNull();

      cleanup();
    });

    it("shows schedule type as daily with time value in edit mode", async () => {
      const dailyTaskFormState: TaskFormState = {
        ...DEFAULT_FORM_STATE,
        name: "Daily Task",
        promptTemplate: "Daily prompt",
        scheduleType: "daily",
        scheduleValue: "14:30",
        scheduleRrule: "FREQ=DAILY;BYHOUR=14;BYMINUTE=30",
        analysisMode: "leaderboard",
        channelIds: ["ch-1"],
      };

      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          formState: dailyTaskFormState,
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage("/tasks/task-456/edit");
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const scheduleSelect = container.querySelector(
        'select[aria-label="排程類型"]',
      ) as HTMLSelectElement;
      expect(scheduleSelect.value).toBe("daily");

      const timeInput = container.querySelector(
        'input[aria-label="每天執行時間"]',
      ) as HTMLInputElement;
      expect(timeInput).not.toBeNull();
      expect(timeInput.value).toBe("14:30");

      cleanup();
    });

    it("shows analysis mode correctly for existing task", async () => {
      const eventTaskFormState: TaskFormState = {
        ...DEFAULT_FORM_STATE,
        name: "Event Task",
        promptTemplate: "Some prompt",
        analysisMode: "intel_event",
        analysisTimeRange: "7d",
        channelIds: ["ch-1"],
      };

      mockUseChatEditor.mockReturnValue(
        createMockHookReturn({
          formState: eventTaskFormState,
        }),
      );

      let result: ReturnType<typeof renderPage>;
      await act(async () => {
        result = renderPage("/tasks/task-789/edit");
        await Promise.resolve();
      });
      const { container, cleanup } = result!;

      const picker = container.querySelector('[data-testid="task-employee-picker"]');
      expect(picker).not.toBeNull();
      const activeTile = picker!.querySelector('[aria-pressed="true"]');
      expect(activeTile?.textContent).toContain("情報任務");

      cleanup();
    });
  });
});
