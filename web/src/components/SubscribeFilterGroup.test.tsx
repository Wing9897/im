import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SubscribeFilterGroup } from "./SubscribeFilterGroup";
import { subscribeCalendarIdentity } from "../domain/calendarShare/subscribedCalendars";
import { i18n, wrapWithI18n } from "../test/i18nHarness";
import { setAppLocale } from "../i18n/locale";

const CALENDARS = [
  subscribeCalendarIdentity({ handle: "Alice", slug: "Work", emoji: "🌞" }),
  subscribeCalendarIdentity({ handle: "Carol", slug: "Team", emoji: "🚧" }),
];

describe("SubscribeFilterGroup", () => {
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
  });

  function renderGroup(
    extra: {
      calendars?: readonly ReturnType<typeof subscribeCalendarIdentity>[];
      draft?: string[] | null;
      query?: string;
      availability?: "ok" | "loggedOut" | "offline";
    } = {},
  ) {
    const onToggleKey = vi.fn();
    const onSelectAll = vi.fn();
    const onClearAll = vi.fn();
    const group = createElement(SubscribeFilterGroup, {
      calendars: extra.calendars ?? CALENDARS,
      draft: extra.draft === undefined ? null : extra.draft,
      query: extra.query ?? "",
      onToggleKey,
      onSelectAll,
      onClearAll,
      availability: extra.availability,
    });
    act(() => {
      root.render(
        wrapWithI18n(
          extra.availability === "loggedOut" ? createElement(MemoryRouter, null, group) : group,
        ),
      );
    });
    return { onToggleKey, onSelectAll, onClearAll };
  }

  it("renders catalog emoji and does not keep an invisible chevron spacer", () => {
    renderGroup({
      calendars: [subscribeCalendarIdentity({ handle: "Alice", slug: "Work", emoji: "🌞" })],
    });
    expect(container.querySelector('[data-testid="timeline-subscribe-emoji-Alice/Work"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-subscribe-emoji-Alice/Work"]')?.textContent).toContain(
      "🌞",
    );
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]')).toBeTruthy();
    expect(container.textContent).toContain("Alice/Work");
    const chevrons = [...container.querySelectorAll("svg")].filter((node) =>
      node.classList.contains("invisible"),
    );
    expect(chevrons).toHaveLength(0);
  });

  it("renders an icon heading, not a parent tri-state checkbox", () => {
    renderGroup();
    const heading = container.querySelector('[data-testid="timeline-filter-section-subscribe"]');
    expect(heading?.querySelector("svg")).toBeTruthy();
    expect(heading?.textContent).toContain("Subscriptions");
    expect(heading?.querySelector("h3")?.getAttribute("title")).toBe("Subscriptions");
    expect(container.querySelector('[data-testid="timeline-subscribe-filter"]')?.getAttribute("aria-label")).toBe(
      "Subscriptions",
    );
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Carol/Team"]')).toBeTruthy();
  });

  it("toggles a calendar key from the top-level row", () => {
    const { onToggleKey } = renderGroup();
    act(() => {
      (container.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]') as HTMLInputElement).click();
    });
    expect(onToggleKey).toHaveBeenCalledWith("Alice/Work");
  });

  it("shows empty copy when the catalog is empty", () => {
    renderGroup({ calendars: [] });
    expect(container.querySelector('[data-testid="timeline-subscribe-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-filter-subscribe-select-all"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-filter-subscribe-clear"]')).toBeTruthy();
  });

  it("calls column select-all and clear without requiring a search query", () => {
    const { onSelectAll, onClearAll } = renderGroup();
    const selectAll = container.querySelector(
      '[data-testid="timeline-filter-subscribe-select-all"]',
    ) as HTMLButtonElement;
    const clear = container.querySelector(
      '[data-testid="timeline-filter-subscribe-clear"]',
    ) as HTMLButtonElement;
    expect(selectAll.getAttribute("aria-label")).toBe("Select all subscriptions");
    expect(clear.getAttribute("aria-label")).toBe("Clear subscriptions");
    act(() => {
      selectAll.click();
    });
    act(() => {
      clear.click();
    });
    expect(onSelectAll).toHaveBeenCalledTimes(1);
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("filters calendar rows by handle/slug like subscription cards and keeps the pane when nothing matches", () => {
    renderGroup({ query: "Carol" });
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Carol/Team"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]')).toBeNull();

    renderGroup({ query: "Work" });
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Alice/Work"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-subscribe-toggle-Carol/Team"]')).toBeNull();

    renderGroup({ query: "zzz-no-match" });
    expect(container.querySelector('[data-testid="timeline-subscribe-filter"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-subscribe-empty"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timeline-subscribe-empty"]')?.textContent).toBe(
      "No matching calendars.",
    );
    expect(container.querySelector('[data-testid="timeline-filter-subscribe-scroll"]')?.className).toContain(
      "overflow-y-auto",
    );
  });

  it("greys the subscribe column when offline and ignores toggles", () => {
    const { onToggleKey, onSelectAll } = renderGroup({ availability: "offline" });
    const status = container.querySelector('[data-testid="timeline-subscribe-disabled"]');
    expect(status?.textContent).toMatch(/unreachable/i);
    expect(container.querySelector('[data-testid="timeline-subscribe-filter"]')?.className).not.toContain(
      "needLogin",
    );
    const checkbox = container.querySelector(
      '[data-testid="timeline-subscribe-toggle-Alice/Work"]',
    ) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    act(() => {
      checkbox.click();
      (
        container.querySelector('[data-testid="timeline-filter-subscribe-select-all"]') as HTMLButtonElement
      ).click();
    });
    expect(onToggleKey).not.toHaveBeenCalled();
    expect(onSelectAll).not.toHaveBeenCalled();
  });

  it("uses different copy when calendar-share is not signed in", () => {
    renderGroup({ availability: "loggedOut" });
    const status = container.querySelector('[data-testid="timeline-subscribe-disabled"]');
    expect(status?.textContent).toMatch(/sign in/i);
    expect(status?.textContent).not.toMatch(/unreachable/i);
    expect(status?.querySelector('a[href="/account/identity"]')?.textContent).toMatch(/sign-in/i);
  });
});
