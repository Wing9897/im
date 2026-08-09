/**
 * Unit tests for IntelligenceToolbar — source filter + search modal.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { IntelligenceToolbar } from "./IntelligenceToolbar";
import type { ViewMode } from "../../types";
import type { TimeFilterPreset } from "../../components/TimeFilter";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

interface ToolbarOpts {
  search?: string;
  setSearch?: (v: string) => void;
  viewMode?: ViewMode;
  setViewMode?: (m: ViewMode) => void;
  timeFilterPreset?: TimeFilterPreset;
  onTimeFilterChange?: (preset: TimeFilterPreset) => void;
  sortMode?: "event_time" | "analyzed_at";
  onSortModeChange?: (mode: "event_time" | "analyzed_at") => void;
  selectedSources?: SourceFilterSelection;
  setSelectedSources?: (ids: SourceFilterSelection) => void;
  intelligenceTasks?: { id: string; name: string }[];
  isBusy?: boolean;
}

function renderToolbar(opts: ToolbarOpts = {}) {
  const props = {
    isBusy: opts.isBusy ?? false,
    search: opts.search ?? "",
    setSearch: opts.setSearch ?? (() => {}),
    viewMode: (opts.viewMode ?? "card") as ViewMode,
    setViewMode: opts.setViewMode ?? (() => {}),
    timeFilterPreset: (opts.timeFilterPreset ?? "today") as TimeFilterPreset,
    onTimeFilterChange: opts.onTimeFilterChange ?? (() => {}),
    sortMode: opts.sortMode ?? "event_time",
    onSortModeChange: opts.onSortModeChange ?? (() => {}),
    selectedSources: opts.selectedSources ?? null,
    setSelectedSources: opts.setSelectedSources ?? (() => {}),
    intelligenceTasks: opts.intelligenceTasks ?? [
      { id: "task-1", name: "行程事件提取" },
    ],
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      wrapWithI18n(createElement(IntelligenceToolbar, props)),
    );
  });
  return { container, root };
}

describe("IntelligenceToolbar", () => {
  const mounts: { container: HTMLDivElement; root: ReturnType<typeof createRoot> }[] = [];

  beforeEach(async () => {
    await ensureZhHantLocale();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    for (const mount of mounts.splice(0)) {
      act(() => {
        mount.root.unmount();
      });
      mount.container.remove();
    }
  });

  function track(mount: { container: HTMLDivElement; root: ReturnType<typeof createRoot> }) {
    mounts.push(mount);
    return mount.container;
  }

  it("always shows task multi-select, including empty catalog", () => {
    const withTasks = track(renderToolbar());
    expect(withTasks.querySelector('[data-testid="intelligence-source-filter"]')).not.toBeNull();
    expect(withTasks.querySelector('[data-testid="board-source-filter"]')).not.toBeNull();

    const empty = track(renderToolbar({ intelligenceTasks: [] }));
    expect(empty.querySelector('[data-testid="intelligence-source-filter"]')).not.toBeNull();
    expect(empty.querySelector('[data-testid="board-source-filter"]')).not.toBeNull();
  });

  it("uses sticky single-row chrome with source filter on the left", () => {
    const container = track(renderToolbar());
    const toolbar = container.querySelector<HTMLDivElement>("[role='toolbar']")!;
    expect(toolbar.className).toContain("im-intelligence-toolbar");
    expect(toolbar.className).toContain("im-control-bar");
    expect(toolbar.className).toContain("sticky");
    expect(toolbar.className).toContain("flex-nowrap");
    expect(toolbar.className).toContain("top-0");
    const search = toolbar.querySelector('[data-testid="intelligence-search-filter-button"]');
    const task = toolbar.querySelector('[data-testid="intelligence-source-filter"]');
    const view = toolbar.querySelector('[aria-label="檢視模式"]');
    expect(search).not.toBeNull();
    expect(task).not.toBeNull();
    const sortSelect = toolbar.querySelector<HTMLElement>(
      '[data-testid="intelligence-sort-select"]',
    );
    expect(sortSelect).not.toBeNull();
    expect(sortSelect!.className).toContain("w-auto");
    expect(sortSelect!.className).not.toContain("w-full");
    const timeFilter = toolbar.querySelector<HTMLElement>('[data-testid="time-filter"]');
    expect(timeFilter).not.toBeNull();
    expect(timeFilter!.className).toContain("w-auto");
    expect(timeFilter!.className).not.toContain("w-full");
    expect(view).not.toBeNull();
    // Source filter leftmost (same as timeline); search sits with view on the right.
    expect(
      Boolean(
        search &&
          task &&
          task.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(
      Boolean(
        search && view && search.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("opens search modal from the search icon", () => {
    const container = track(renderToolbar());
    expect(container.querySelector('[data-testid="intelligence-search-filter-input"]')).toBeNull();
    const openBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="intelligence-search-filter-button"]',
    )!;
    act(() => {
      openBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const input = document.body.querySelector<HTMLInputElement>(
      '[data-testid="intelligence-search-filter-input"]',
    );
    expect(input).not.toBeNull();
    expect(input!.maxLength).toBe(200);
    expect(document.body.textContent).toContain("搜尋情報事件");
  });

  it("clears search from the modal footer", () => {
    const setSearch = vi.fn();
    const container = track(renderToolbar({ search: "alert", setSearch }));
    const openBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="intelligence-search-filter-button"]',
    )!;
    act(() => {
      openBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const dialog = document.body.querySelector(
      '[data-testid="intelligence-search-filter-dialog"]',
    );
    expect(dialog).not.toBeNull();
    const clearBtn = Array.from(dialog!.querySelectorAll("button")).find(
      (btn) => btn.textContent === "清除",
    );
    expect(clearBtn).toBeTruthy();
    expect(clearBtn!.disabled).toBe(false);
    act(() => {
      clearBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(setSearch).toHaveBeenCalledWith("");
  });

  it("hides time filter and sort in map mode (map has its own timeline)", () => {
    const container = track(renderToolbar({ viewMode: "map" }));
    expect(container.querySelector('[data-testid="time-filter"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="intelligence-sort-select"]'),
    ).toBeNull();
    expect(container.querySelector('[aria-label="檢視模式"]')).not.toBeNull();
  });

  it("calls onTimeFilterChange when time select changes", () => {
    const onTimeFilterChange = vi.fn();
    const container = track(renderToolbar({ onTimeFilterChange, timeFilterPreset: "today" }));
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="time-filter-value"]',
    )!;
    act(() => {
      trigger.click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>('[data-testid="time-filter-option-7d"]')
        ?.click();
    });
    expect(onTimeFilterChange).toHaveBeenCalledWith("7d");
  });

  it("calls onSortModeChange when sort select changes", () => {
    const onSortModeChange = vi.fn();
    const container = track(renderToolbar({
      onSortModeChange,
      sortMode: "event_time",
    }));
    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-testid="intelligence-sort-select-value"]',
    )!;
    act(() => {
      trigger.click();
    });
    act(() => {
      document.body
        .querySelector<HTMLButtonElement>(
          '[data-testid="intelligence-sort-select-option-analyzed_at"]',
        )
        ?.click();
    });
    expect(onSortModeChange).toHaveBeenCalledWith("analyzed_at");
  });

  it("smoke: English toolbar aria when locale is en", async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    const container = track(renderToolbar());
    expect(
      container.querySelector('[aria-label="Intel events toolbar"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="intelligence-source-filter"]')).not.toBeNull();
  });
});
