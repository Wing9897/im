/**
 * Task form for create/edit — two-column on md+; tall fields span full width.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { DEFAULT_FORM_STATE } from "../../../hooks/useTaskEditorState";
import { ChatEditorForm } from "./ChatEditorForm";

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  setAppLocale("zh-Hant");
  await i18n.changeLanguage("zh-Hant");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ChatEditorForm recurring-only contract", () => {
  it.each(["leaderboard", "event"] as const)(
    "shows recurrence controls/helper copy only in recurring mode, not %s mode",
    (analysisMode) => {
      const helperCopy = String(i18n.t("tasks.editor.rruleHint"));
      const renderMode = (mode: typeof DEFAULT_FORM_STATE.analysisMode) => {
        act(() =>
          root.render(
            createElement(
              I18nextProvider,
              { i18n },
              createElement(ChatEditorForm, {
                formState: { ...DEFAULT_FORM_STATE, analysisMode: mode, rrule: "FREQ=DAILY" },
                updateField: () => undefined,
                channels: [],
                onOpenChannelDialog: () => undefined,
              }),
            ),
          ),
        );
      };

      renderMode("recurring");
      expect(container.querySelector('[role="note"]')?.textContent).toBe(helperCopy);
      expect(container.textContent).toContain("重複規則");
      expect(container.querySelector('[aria-label="排程類型"]')).toBeNull();
      expect(container.querySelector('[aria-label="進階設定"]')).toBeNull();

      renderMode(analysisMode);
      expect(container.querySelector('[role="note"]')).toBeNull();
      expect(container.textContent).not.toContain("重複規則");
      expect(container.querySelector('[aria-label="排程類型"]')).not.toBeNull();
      expect(container.querySelector('[aria-label="進階設定"]')).not.toBeNull();
    },
  );

  it("shows project wave interval after schedule type in project mode", async () => {
    await act(async () => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "project",
              scheduleType: "hourly",
              projectWaveIntervalSeconds: 20,
            },
            updateField: () => undefined,
            channels: [],
            onOpenChannelDialog: () => undefined,
          }),
        ),
      );
    });
    expect(container.querySelector('[data-testid="schedule-project-wave-interval"]')).not.toBeNull();
    expect(container.textContent).toContain("專案波間間隔");
  });

  it("binds project wave interval to form state instead of system settings", async () => {
    const updateField = vi.fn();
    await act(async () => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(ChatEditorForm, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "project",
              scheduleType: "hourly",
              projectWaveIntervalSeconds: 15,
            },
            updateField,
            channels: [],
            onOpenChannelDialog: () => undefined,
          }),
        ),
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
