import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceFilterSelection } from "../../../domain/tasks/sourceFilterSelection";
import { TimelineSourceFilterDialog } from "./TimelineSourceFilterDialog";
import { i18n, wrapWithI18n } from "../../../test/i18nHarness";
import { setAppLocale } from "../../../i18n/locale";

const TASKS = [
  { id: "task-1", name: "First task" },
  { id: "task-2", name: "Second task" },
  { id: "task-3", name: "Third task" },
];

const WORKSETS = [
  { id: "__general__", name: "General" },
  { id: "ws-1", name: "Ops" },
];

const EXPAND_TASKS = [
  { id: "task-1", name: "First task", worksetId: "ws-1" },
  { id: "task-2", name: "Second task", worksetId: "ws-1" },
  { id: "task-3", name: "Third task", worksetId: "__general__" },
];

describe("TimelineSourceFilterDialog", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.querySelectorAll('[data-testid="source-filter-dialog"]').forEach((node) => node.remove());
  });

  function renderDialog(
    selection: SourceFilterSelection = null,
    extra: {
      subscribeCalendars?: { key: string; label: string }[];
      selectedSubscribeKeys?: string[] | null;
      onChangeSubscribeKeys?: (next: string[] | null) => void;
    } = {},
  ) {
    const onChange = vi.fn();
    const onChangeSubscribeKeys = extra.onChangeSubscribeKeys ?? vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(TimelineSourceFilterDialog, {
            tasks: TASKS,
            worksets: WORKSETS,
            expandTasks: EXPAND_TASKS,
            selection,
            onChange,
            ariaLabelPrefix: "Timeline",
            variant: "toolbar",
            subscribeCalendars: extra.subscribeCalendars ?? [
              { key: "Alice/Work", label: "Alice/Work" },
              { key: "Carol/Team", label: "Carol/Team" },
            ],
            selectedSubscribeKeys: extra.selectedSubscribeKeys ?? null,
            onChangeSubscribeKeys,
          }),
        ),
      );
    });
    return { onChange, onChangeSubscribeKeys };
  }

  function openDialog() {
    const trigger = container.querySelector(
      '[data-testid="board-source-filter"]',
    ) as HTMLButtonElement;
    act(() => {
      trigger.click();
    });
    return trigger;
  }

  it("renders subscribed calendars as a first-class group and applies their keys separately", () => {
    const { onChange, onChangeSubscribeKeys } = renderDialog();
    openDialog();

    const group = document.querySelector('[data-testid="timeline-subscribe-filter"]');
    expect(group).toBeTruthy();
    expect(group?.getAttribute("aria-label")).toBe("Subscriptions");
    const localHeading = document.querySelector('[data-testid="timeline-filter-section-local"]');
    const subscribeHeading = document.querySelector('[data-testid="timeline-filter-section-subscribe"]');
    expect(localHeading?.querySelector("svg")).toBeTruthy();
    expect(subscribeHeading?.querySelector("svg")).toBeTruthy();
    expect(localHeading?.textContent).toContain("Local");
    expect(subscribeHeading?.textContent).toContain("Subscriptions");
    expect(localHeading?.querySelector("h3")?.getAttribute("title")).toBe("Local");
    expect(subscribeHeading?.querySelector("h3")?.getAttribute("title")).toBe("Subscriptions");
    expect(document.querySelector('[data-testid="timeline-filter-columns"]')?.className).toContain(
      "sm:flex-row",
    );
    expect(document.querySelector('[data-testid="timeline-filter-local"]')?.getAttribute("aria-label")).toBe(
      "Local",
    );
    expect(document.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-subscribe-toggle-Carol/Team"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-filter-local-select-all"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-filter-subscribe-select-all"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-__general__"]')).toBeTruthy();

    act(() => {
      (document.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]') as HTMLInputElement).click();
    });
    act(() => {
      (document.querySelector('[data-testid="source-filter-apply"]') as HTMLButtonElement).click();
    });
    expect(onChangeSubscribeKeys).toHaveBeenCalledWith(["Carol/Team"]);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("still shows the subscription section when the catalog is empty", () => {
    renderDialog(null, { subscribeCalendars: [] });
    openDialog();
    expect(document.querySelector('[data-testid="timeline-subscribe-filter"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-subscribe-empty"]')).toBeTruthy();
  });

  it("keeps select-all and clear on each column, not in the shared footer", () => {
    renderDialog();
    openDialog();
    const localSelect = document.querySelector(
      '[data-testid="timeline-filter-local-select-all"]',
    ) as HTMLButtonElement;
    const localClear = document.querySelector(
      '[data-testid="timeline-filter-local-clear"]',
    ) as HTMLButtonElement;
    const subscribeSelect = document.querySelector(
      '[data-testid="timeline-filter-subscribe-select-all"]',
    ) as HTMLButtonElement;
    const subscribeClear = document.querySelector(
      '[data-testid="timeline-filter-subscribe-clear"]',
    ) as HTMLButtonElement;
    expect(localSelect?.textContent).toBe("Select all");
    expect(localClear?.textContent).toBe("Clear");
    expect(subscribeSelect?.textContent).toBe("Select all");
    expect(subscribeClear?.textContent).toBe("Clear");
    expect(localSelect.getAttribute("aria-label")).toBe("Select all local sources");
    expect(localClear.getAttribute("aria-label")).toBe("Clear local sources");
    expect(subscribeSelect.getAttribute("aria-label")).toBe("Select all subscriptions");
    expect(subscribeClear.getAttribute("aria-label")).toBe("Clear subscriptions");
    const footer = document.querySelector('[data-testid="source-filter-dialog"] [role="dialog"]')
      ?.lastElementChild;
    expect(footer?.querySelector('[data-testid="timeline-filter-local-select-all"]')).toBeNull();
    expect(footer?.querySelector('[data-testid="timeline-filter-subscribe-clear"]')).toBeNull();
    expect(footer?.querySelector('[data-testid="source-filter-apply"]')).toBeTruthy();
    expect(footer?.querySelectorAll("button")).toHaveLength(1);
  });

  it("local clear applies only the local tree", () => {
    const { onChange, onChangeSubscribeKeys } = renderDialog(null, {
      selectedSubscribeKeys: ["Alice/Work"],
    });
    openDialog();
    act(() => {
      (document.querySelector('[data-testid="timeline-filter-local-clear"]') as HTMLButtonElement).click();
    });
    act(() => {
      (document.querySelector('[data-testid="source-filter-apply"]') as HTMLButtonElement).click();
    });
    expect(onChange).toHaveBeenCalledWith({ taskIds: [], worksetIds: [] });
    expect(onChangeSubscribeKeys).not.toHaveBeenCalled();
  });

  it("subscribe clear applies only subscribe keys", () => {
    const { onChange, onChangeSubscribeKeys } = renderDialog(
      { taskIds: ["task-3"], worksetIds: [] },
      { selectedSubscribeKeys: ["Alice/Work"] },
    );
    openDialog();
    act(() => {
      (document.querySelector('[data-testid="timeline-filter-subscribe-clear"]') as HTMLButtonElement).click();
    });
    act(() => {
      (document.querySelector('[data-testid="source-filter-apply"]') as HTMLButtonElement).click();
    });
    expect(onChangeSubscribeKeys).toHaveBeenCalledWith([]);
    expect(onChange).toHaveBeenCalledWith({ taskIds: ["task-3"], worksetIds: [] });
  });

  it("subscribe select-all applies null subscribe keys without resetting local", () => {
    const { onChange, onChangeSubscribeKeys } = renderDialog(
      { taskIds: ["task-3"], worksetIds: [] },
      { selectedSubscribeKeys: ["Alice/Work"] },
    );
    openDialog();
    act(() => {
      (
        document.querySelector('[data-testid="timeline-filter-subscribe-select-all"]') as HTMLButtonElement
      ).click();
    });
    act(() => {
      (document.querySelector('[data-testid="source-filter-apply"]') as HTMLButtonElement).click();
    });
    expect(onChangeSubscribeKeys).toHaveBeenCalledWith(null);
    expect(onChange).toHaveBeenCalledWith({ taskIds: ["task-3"], worksetIds: [] });
  });

  it("local select-all applies null local selection without resetting subscribe keys", () => {
    const { onChange, onChangeSubscribeKeys } = renderDialog(
      { taskIds: ["task-3"], worksetIds: [] },
      { selectedSubscribeKeys: ["Alice/Work"] },
    );
    openDialog();
    act(() => {
      (document.querySelector('[data-testid="timeline-filter-local-select-all"]') as HTMLButtonElement).click();
    });
    act(() => {
      (document.querySelector('[data-testid="source-filter-apply"]') as HTMLButtonElement).click();
    });
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onChangeSubscribeKeys).not.toHaveBeenCalled();
  });

  it("search filters both local worksets and subscribe labels without hiding a column", () => {
    renderDialog();
    openDialog();
    const search = document.querySelector(
      '[data-testid="source-filter-dialog-search"]',
    ) as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    act(() => {
      setter.call(search, "Alice");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(document.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-subscribe-toggle-Carol/Team"]')).toBeNull();
    expect(document.querySelector('[data-testid="timeline-filter-local"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-subscribe-filter"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="board-workset-filter-ws-1"]')).toBeNull();
  });

  it("keeps a fixed-size shell with independently scrolling columns", () => {
    renderDialog();
    openDialog();
    const shell = document.querySelector('[data-testid="source-filter-dialog"] [role="dialog"]');
    const shellClasses = shell?.className.split(/\s+/) ?? [];
    expect(shellClasses).toContain("w-[720px]");
    expect(shellClasses).toContain("h-[min(86vh,780px)]");
    expect(shellClasses).toContain("overflow-hidden");
    expect(shellClasses).not.toContain("max-h-[min(86vh,780px)]");
    const localScroll = document.querySelector('[data-testid="timeline-filter-local-scroll"]');
    const subscribeScroll = document.querySelector('[data-testid="timeline-filter-subscribe-scroll"]');
    expect(localScroll?.className).toContain("overflow-y-auto");
    expect(localScroll?.className).toContain("min-h-0");
    expect(subscribeScroll?.className).toContain("overflow-y-auto");
    expect(subscribeScroll?.className).toContain("min-h-0");
  });
});
