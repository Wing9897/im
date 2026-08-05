/**
 * Rendering variant tests for TelegramSourceListSection.
 *
 * Rendering variant tests for components that render differently based on
 * data size: empty list, single item, many items.
 *
 * TelegramSourceListSection has multiple data-driven rendering branches:
 *   - Loading state (spinner only)
 *   - Empty (no sources) → EmptyState shown, refresh button disabled
 *   - Single item → header count badge, one card rendered
 *   - Many items → all cards rendered in order, refresh button enabled
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

import { TelegramSourceListSection } from "./TelegramSourceListSection";
import type { Source } from "../../../types";

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "acc-1",
    platform: "telegram",
    name: "Test Source",
    status: "connected",
    lastError: null,
    lastConnectedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface RenderArgs {
  sources?: Source[];
  initialLoading?: boolean;
  isRefreshing?: boolean;
  refreshingAllSources?: boolean;
  refreshAllNotice?: string | null;
  reconnecting?: string | null;
  reconnectError?: string | null;
  reconnectErrorTarget?: string | null;
}

function renderSection(container: HTMLElement, args: RenderArgs = {}) {
  const props = {
    sources: args.sources ?? [],
    initialLoading: args.initialLoading ?? false,
    isRefreshing: args.isRefreshing ?? false,
    refreshingAllSources: args.refreshingAllSources ?? false,
    refreshAllNotice: args.refreshAllNotice ?? null,
    reconnecting: args.reconnecting ?? null,
    reconnectError: args.reconnectError ?? null,
    reconnectErrorTarget: args.reconnectErrorTarget ?? null,
    onRefreshAll: vi.fn(async () => {}),
    onReconnect: vi.fn(async () => {}),
    onRemoveClick: vi.fn(),
    onEditClick: vi.fn(),
  };
  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(TelegramSourceListSection, props),
      ),
    );
  });
  return { props, root: root! };
}

describe("TelegramSourceListSection — empty variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders the empty state placeholder when sources list is empty", () => {
    ({ root } = renderSection(container, { sources: [], initialLoading: false }));

    expect(container.textContent).toContain("尚未新增任何來源");
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
  });

  it("disables the 'refresh all' button when sources is empty", () => {
    ({ root } = renderSection(container, { sources: [] }));

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部來源");
    expect(refreshButton).toBeDefined();
    expect(refreshButton!.disabled).toBe(true);
  });

  it("does not render the count suffix in the header when loading", () => {
    ({ root } = renderSection(container, { initialLoading: true, sources: [] }));

    // The "(N)" count is only shown when not loading.
    expect(container.querySelector(".sources-count-badge")).toBeNull();
  });
});

describe("TelegramSourceListSection — single-item variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("shows count badge for a single source", () => {
    ({ root } = renderSection(container, { sources: [makeSource()] }));

    expect(container.querySelector(".sources-count-badge")?.textContent).toBe("1");
  });

  it("renders exactly one card in the grid", () => {
    ({ root } = renderSection(container, {
      sources: [makeSource({ name: "Alice" })],
    }));

    const grid = container.querySelector(".sources-card-grid");
    expect(grid).not.toBeNull();
    // The grid contains card div children — exactly one for a single source.
    expect(grid!.children.length).toBe(1);
    expect(grid!.textContent).toContain("Alice");
  });

  it("hides the empty state when at least one source exists", () => {
    ({ root } = renderSection(container, { sources: [makeSource()] }));

    expect(container.textContent).not.toContain("尚未新增任何來源");
  });

  it("enables the 'refresh all' button when at least one source exists", () => {
    ({ root } = renderSection(container, { sources: [makeSource()] }));

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部來源");
    expect(refreshButton).toBeDefined();
    expect(refreshButton!.disabled).toBe(false);
  });
});

describe("TelegramSourceListSection — many-items variant", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders one card per source in the order provided", () => {
    const sources = Array.from({ length: 12 }, (_, i) =>
      makeSource({
        id: `acc-${i}`,
        name: `Source ${i}`,
      }),
    );
    ({ root } = renderSection(container, { sources }));

    const grid = container.querySelector(".sources-card-grid")!;
    expect(grid.children.length).toBe(12);

    // Order is preserved.
    for (let i = 0; i < sources.length; i++) {
      expect((grid.children[i] as HTMLElement).textContent).toContain(
        `Source ${i}`,
      );
    }
  });

  it("shows the correct count suffix for many sources", () => {
    const sources = Array.from({ length: 25 }, (_, i) =>
      makeSource({ id: `acc-${i}` }),
    );
    ({ root } = renderSection(container, { sources }));

    expect(container.querySelector(".sources-count-badge")?.textContent).toBe("25");
  });

  it("renders status labels for sources in different statuses", () => {
    const sources = [
      makeSource({ id: "a1", name: "Connected", status: "connected" }),
      makeSource({
        id: "a2",
        name: "Disconnected",
        status: "disconnected",
      }),
      makeSource({ id: "a3", name: "Errored", status: "error" }),
    ];
    ({ root } = renderSection(container, { sources }));

    expect(container.textContent).toContain("已連線");
    expect(container.textContent).toContain("已斷線");
    expect(container.textContent).toContain("錯誤");
  });
});

describe("TelegramSourceListSection — refresh interaction boundary", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("calls onRefreshAll when the refresh button is clicked with non-empty list", () => {
    const { props } = renderSection(container, { sources: [makeSource()] });

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部來源")!;
    act(() => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("disables the refresh button while a single-source reconnect is in flight", () => {
    ({ root } = renderSection(container, {
      sources: [makeSource({ id: "acc-1" })],
      reconnecting: "acc-1",
    }));

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部來源")!;
    expect(refreshButton.disabled).toBe(true);
  });

  it("shows the global refresh notice banner when refreshAllNotice is set", () => {
    ({ root } = renderSection(container, {
      sources: [makeSource()],
      refreshAllNotice: "已成功重連 3 個來源",
    }));

    expect(container.textContent).toContain("已成功重連 3 個來源");
  });
});
