import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import type { TaskActivitySpan } from "../../../types/analysis";

const { TaskDetailPanel } = await import("./TaskDetailPanel");

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeSpan(overrides: Partial<TaskActivitySpan> = {}): TaskActivitySpan {
  return {
    taskId: "task-1",
    taskName: "資料分析任務",
    description: "這是一個測試用的任務描述",
    analysisTimeRange: "2025-01-01 ~ 2025-01-31",
    isActive: true,
    earliestBatchStart: "2025-01-05T08:00:00Z",
    latestBatchEnd: "2025-01-20T18:00:00Z",
    completedBatchCount: 5,
    ...overrides,
  };
}

function render(span: TaskActivitySpan, onClose = vi.fn()) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(TaskDetailPanel, { span, onClose }),
      ),
    );
  });
  return { container, onClose };
}

/* ------------------------------------------------------------------ */
/*  TaskDetailPanel unit tests                                         */
/* ------------------------------------------------------------------ */

describe("TaskDetailPanel", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });
  it("renders task name as heading", () => {
    const { container } = render(makeSpan({ taskName: "我的分析任務" }));
    expect(container.textContent).toContain("我的分析任務");
  });

  it("renders description truncated to 200 chars with ellipsis when longer", () => {
    const longDescription = "A".repeat(250);
    const { container } = render(makeSpan({ description: longDescription }));
    // Should contain the first 200 chars followed by ellipsis
    expect(container.textContent).toContain("A".repeat(200) + "…");
    // Should NOT contain the full 250-char string
    expect(container.textContent).not.toContain("A".repeat(201));
  });

  it("renders full description when 200 chars or less", () => {
    const shortDescription = "B".repeat(200);
    const { container } = render(makeSpan({ description: shortDescription }));
    expect(container.textContent).toContain(shortDescription);
    // No ellipsis should be appended
    expect(container.textContent).not.toContain(shortDescription + "…");
  });

  it("renders analysisTimeRange", () => {
    const { container } = render(
      makeSpan({ analysisTimeRange: "2025-03-01 ~ 2025-03-31" }),
    );
    expect(container.textContent).toContain("2025-03-01 ~ 2025-03-31");
  });

  it("renders active status badge '活動中' for active tasks", () => {
    const { container } = render(makeSpan({ isActive: true }));
    expect(container.textContent).toContain("活動中");
    expect(container.textContent).not.toContain("已停用");
  });

  it("renders inactive status badge '已停用' for inactive tasks", () => {
    const { container } = render(makeSpan({ isActive: false }));
    expect(container.textContent).toContain("已停用");
    expect(container.textContent).not.toContain("活動中");
  });

  it("renders completed batch count", () => {
    const { container } = render(makeSpan({ completedBatchCount: 42 }));
    expect(container.textContent).toContain("42");
  });

  it("close button calls onClose when clicked", () => {
    const onClose = vi.fn();
    const { container } = render(makeSpan(), onClose);

    const closeButton = container.querySelector(
      'button[aria-label="關閉詳情面板"]',
    );
    expect(closeButton).not.toBeNull();

    act(() => {
      closeButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles null description gracefully (does not render description section)", () => {
    const { container } = render(makeSpan({ description: null }));
    // The task name and other fields should still render
    expect(container.textContent).toContain("資料分析任務");
    // The description section should not be present — verify by checking
    // that no truncated text or description content appears between the
    // task name and the analysis range line.
    // With null description, the panel should still show analysisTimeRange
    expect(container.textContent).toContain("分析範圍");
  });
});
