import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../test/i18nHarness";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { DEFAULT_SCHEDULE_FILTERS } from "./scheduleFilters";
import { ScheduleToolbar } from "./ScheduleToolbar";

describe("ScheduleToolbar", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
    document.querySelectorAll('[data-testid="schedule-filter-dialog"]').forEach((node) => node.remove());
  });

  function renderToolbar(
    overrides: Partial<Parameters<typeof ScheduleToolbar>[0]> = {},
  ) {
    const onFiltersChange = overrides.onFiltersChange ?? vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(ScheduleToolbar, {
            t: i18n.getFixedT("zh-Hant", "schedule"),
            searchQuery: "",
            onSearchQueryChange: vi.fn(),
            filters: DEFAULT_SCHEDULE_FILTERS,
            onFiltersChange,
            worksets: [
              {
                id: SYSTEM_WORKSET_ID,
                name: "一般",
                isSystem: true,
                notifyEnabled: true,
                externalEnabled: true,
                createdAt: "",
                updatedAt: "",
              },
              {
                id: "ws-ops",
                name: "營運",
                isSystem: false,
                notifyEnabled: true,
                externalEnabled: true,
                createdAt: "",
                updatedAt: "",
              },
            ],
            onCreate: vi.fn(),
            ...overrides,
          }),
        ),
      );
    });
    return { onFiltersChange };
  }

  function filterDialog(): ParentNode {
    const dialogs = document.body.querySelectorAll('[data-testid="schedule-filter-dialog"]');
    return dialogs[dialogs.length - 1] ?? document.body;
  }

  function openFilters() {
    act(() => {
      (container.querySelector('[data-testid="schedule-filter-trigger"]') as HTMLButtonElement).click();
    });
  }

  it("keeps a compact Filter icon on the toolbar instead of inline chips", () => {
    renderToolbar();

    expect(container.querySelector('[data-testid="schedule-toolbar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-filter-trigger"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="schedule-filter-badge"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-type-filter"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-workset-filter"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-date-from"]')).toBeNull();
    expect(container.querySelector('[data-testid="schedule-filters-clear"]')).toBeNull();
  });

  it("opens a panel with type, searchable workset, and date range", () => {
    renderToolbar();
    openFilters();

    const dialog = filterDialog();
    expect(dialog.querySelector('[data-testid="schedule-filter-panel"]')).toBeTruthy();
    expect(dialog.querySelector('[data-testid="schedule-type-filter"]')).toBeTruthy();
    expect(dialog.querySelector('[data-testid="schedule-type-filter-oneOff"]')?.textContent).toBe(
      "一般",
    );
    expect(dialog.querySelector('[data-testid="schedule-type-filter-recurring"]')?.textContent).toBe(
      "循環",
    );
    expect(dialog.querySelector('[data-testid="schedule-workset-search"]')).toBeTruthy();
    expect(dialog.querySelector('[data-testid="schedule-workset-filter"]')).toBeTruthy();
    expect(dialog.querySelector('[data-testid="schedule-workset-option-all"]')?.textContent).toBe(
      "全部工作集",
    );
    expect(dialog.querySelector('[data-testid="schedule-workset-option-ws-ops"]')?.textContent).toBe(
      "營運",
    );
    expect(dialog.querySelector('[data-testid="schedule-date-from"]')?.getAttribute("type")).toBe(
      "date",
    );
    expect(dialog.querySelector('[data-testid="schedule-date-to"]')?.getAttribute("type")).toBe(
      "date",
    );
  });

  it("emits type changes from filter chips in the panel", () => {
    const { onFiltersChange } = renderToolbar();
    openFilters();

    act(() => {
      (filterDialog().querySelector('[data-testid="schedule-type-filter-oneOff"]') as HTMLButtonElement).click();
    });
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_SCHEDULE_FILTERS,
      type: "oneOff",
    });
  });

  it("emits workset changes from the searchable list", () => {
    const { onFiltersChange } = renderToolbar();
    openFilters();

    act(() => {
      (filterDialog().querySelector('[data-testid="schedule-workset-option-ws-ops"]') as HTMLButtonElement).click();
    });
    expect(onFiltersChange).toHaveBeenCalledWith({
      ...DEFAULT_SCHEDULE_FILTERS,
      worksetId: "ws-ops",
    });
  });

  it("filters the workset list by search query", () => {
    renderToolbar();
    openFilters();

    const search = filterDialog().querySelector(
      '[data-testid="schedule-workset-search"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(search, "營");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(filterDialog().querySelector('[data-testid="schedule-workset-option-ws-ops"]')).toBeTruthy();
    expect(filterDialog().querySelector(`[data-testid="schedule-workset-option-${SYSTEM_WORKSET_ID}"]`)).toBeNull();
    expect(filterDialog().querySelector('[data-testid="schedule-workset-option-all"]')).toBeNull();
  });

  it("shows a badge when a filter is active and clears from the panel", () => {
    const onFiltersChange = vi.fn();
    renderToolbar({
      filters: { ...DEFAULT_SCHEDULE_FILTERS, type: "recurring" },
      onFiltersChange,
    });

    const trigger = container.querySelector(
      '[data-testid="schedule-filter-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute("aria-label")).toContain("1");
    expect(container.querySelector('[data-testid="schedule-filter-badge"]')?.textContent).toBe("1");

    openFilters();
    const clear = filterDialog().querySelector(
      '[data-testid="schedule-filters-clear"]',
    ) as HTMLButtonElement;
    expect(clear).toBeTruthy();
    act(() => {
      clear.click();
    });
    expect(onFiltersChange).toHaveBeenCalledWith(DEFAULT_SCHEDULE_FILTERS);
  });
});
