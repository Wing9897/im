/**
 * Rendering variant tests for AccountListSection.
 *
 * Validates: Requirement 8.5 (rendering variant tests for components that
 * render differently based on data size: empty list, single item, many items).
 *
 * AccountListSection has multiple data-driven rendering branches:
 *   - Loading state (spinner only)
 *   - Empty (no accounts) → EmptyState shown, refresh button disabled
 *   - Single item → header count badge, one card rendered
 *   - Many items → all cards rendered in order, refresh button enabled
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";

import { AccountListSection } from "./AccountListSection";
import type { Account } from "../../../types";

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    platform: "telegram",
    name: "Test Account",
    status: "connected",
    lastError: null,
    lastConnectedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

interface RenderArgs {
  accounts?: Account[];
  initialLoading?: boolean;
  isRefreshing?: boolean;
  refreshingAllAccounts?: boolean;
  refreshAllNotice?: string | null;
  reconnecting?: string | null;
  reconnectError?: string | null;
  reconnectErrorTarget?: string | null;
}

function renderSection(container: HTMLElement, args: RenderArgs = {}) {
  const props = {
    accounts: args.accounts ?? [],
    initialLoading: args.initialLoading ?? false,
    isRefreshing: args.isRefreshing ?? false,
    refreshingAllAccounts: args.refreshingAllAccounts ?? false,
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
        createElement(AccountListSection, props),
      ),
    );
  });
  return { props, root: root! };
}

describe("AccountListSection — empty variant", () => {
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

  it("renders the empty state placeholder when accounts list is empty", () => {
    ({ root } = renderSection(container, { accounts: [], initialLoading: false }));

    expect(container.textContent).toContain("尚未新增任何帳號");
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
  });

  it("disables the 'refresh all' button when accounts is empty", () => {
    ({ root } = renderSection(container, { accounts: [] }));

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部帳號");
    expect(refreshButton).toBeDefined();
    expect(refreshButton!.disabled).toBe(true);
  });

  it("does not render the count suffix in the header when loading", () => {
    ({ root } = renderSection(container, { initialLoading: true, accounts: [] }));

    // The "(N)" count is only shown when not loading.
    expect(container.querySelector(".sources-count-badge")).toBeNull();
  });
});

describe("AccountListSection — single-item variant", () => {
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

  it("shows count badge for a single account", () => {
    ({ root } = renderSection(container, { accounts: [makeAccount()] }));

    expect(container.querySelector(".sources-count-badge")?.textContent).toBe("1");
  });

  it("renders exactly one card in the grid", () => {
    ({ root } = renderSection(container, {
      accounts: [makeAccount({ name: "Alice" })],
    }));

    const grid = container.querySelector(".sources-card-grid");
    expect(grid).not.toBeNull();
    // The grid contains card div children — exactly one for a single account.
    expect(grid!.children.length).toBe(1);
    expect(grid!.textContent).toContain("Alice");
  });

  it("hides the empty state when at least one account exists", () => {
    ({ root } = renderSection(container, { accounts: [makeAccount()] }));

    expect(container.textContent).not.toContain("尚未新增任何帳號");
  });

  it("enables the 'refresh all' button when at least one account exists", () => {
    ({ root } = renderSection(container, { accounts: [makeAccount()] }));

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部帳號");
    expect(refreshButton).toBeDefined();
    expect(refreshButton!.disabled).toBe(false);
  });
});

describe("AccountListSection — many-items variant", () => {
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

  it("renders one card per account in the order provided", () => {
    const accounts = Array.from({ length: 12 }, (_, i) =>
      makeAccount({
        id: `acc-${i}`,
        name: `Account ${i}`,
      }),
    );
    ({ root } = renderSection(container, { accounts }));

    const grid = container.querySelector(".sources-card-grid")!;
    expect(grid.children.length).toBe(12);

    // Order is preserved.
    for (let i = 0; i < accounts.length; i++) {
      expect((grid.children[i] as HTMLElement).textContent).toContain(
        `Account ${i}`,
      );
    }
  });

  it("shows the correct count suffix for many accounts", () => {
    const accounts = Array.from({ length: 25 }, (_, i) =>
      makeAccount({ id: `acc-${i}` }),
    );
    ({ root } = renderSection(container, { accounts }));

    expect(container.querySelector(".sources-count-badge")?.textContent).toBe("25");
  });

  it("renders status labels for accounts in different statuses", () => {
    const accounts = [
      makeAccount({ id: "a1", name: "Connected", status: "connected" }),
      makeAccount({
        id: "a2",
        name: "Disconnected",
        status: "disconnected",
      }),
      makeAccount({ id: "a3", name: "Errored", status: "error" }),
    ];
    ({ root } = renderSection(container, { accounts }));

    expect(container.textContent).toContain("已連線");
    expect(container.textContent).toContain("已斷線");
    expect(container.textContent).toContain("錯誤");
  });
});

describe("AccountListSection — refresh interaction boundary", () => {
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
    const { props } = renderSection(container, { accounts: [makeAccount()] });

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部帳號")!;
    act(() => {
      refreshButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onRefreshAll).toHaveBeenCalledTimes(1);
  });

  it("disables the refresh button while a single-account reconnect is in flight", () => {
    ({ root } = renderSection(container, {
      accounts: [makeAccount({ id: "acc-1" })],
      reconnecting: "acc-1",
    }));

    const refreshButton = Array.from(container.querySelectorAll("button"))
      .find((b) => b.textContent === "更新全部帳號")!;
    expect(refreshButton.disabled).toBe(true);
  });

  it("shows the global refresh notice banner when refreshAllNotice is set", () => {
    ({ root } = renderSection(container, {
      accounts: [makeAccount()],
      refreshAllNotice: "已成功重連 3 個帳號",
    }));

    expect(container.textContent).toContain("已成功重連 3 個帳號");
  });
});
