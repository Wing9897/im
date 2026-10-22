/**
 * Closing the timeline calendar sheet removes its own query keys.
 * A task-graph `tab` or a subscriptions tab that does not belong to the
 * sheet being closed stays in the URL.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

vi.mock("../schedule/SchedulePage", () => ({
  SchedulePage: () => createElement("div", { "data-testid": "schedule-stub" }),
}));

vi.mock("../subscriptions/SubscriptionsShell", () => ({
  parseSubscriptionsTab: (value: string | null | undefined) =>
    value === "published" || value === "account" || value === "search" || value === "mine"
      ? value
      : "mine",
  SubscriptionsShell: () => createElement("div", { "data-testid": "subscriptions-stub" }),
}));

import { TimelineCalendarSheet } from "./TimelineCalendarSheet";

function LocationProbe() {
  const location = useLocation();
  return createElement("div", { "data-testid": "loc", "data-search": location.search });
}

describe("TimelineCalendarSheet close", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    await ensureZhHantLocale();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  async function renderAt(path: string) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            { initialEntries: [path] },
            createElement("div", null, createElement(LocationProbe), createElement(TimelineCalendarSheet)),
          ),
        ),
      );
      await Promise.resolve();
    });
  }

  function search(): URLSearchParams {
    const raw = container.querySelector("[data-testid='loc']")?.getAttribute("data-search") ?? "";
    return new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw);
  }

  async function closeSheet() {
    const dialog = document.body.querySelector("[data-testid='timeline-calendar-sheet']");
    expect(dialog).not.toBeNull();
    const close = Array.from(dialog!.querySelectorAll("button")).find(
      (btn) => btn.textContent === "關閉",
    );
    expect(close).toBeTruthy();
    await act(async () => {
      close!.click();
      await Promise.resolve();
    });
  }

  it("keeps a task graph tab when the schedule sheet closes", async () => {
    await renderAt("/timeline?sheet=schedule&tab=graph&series=series-1");
    await closeSheet();

    expect(search().get("sheet")).toBeNull();
    expect(search().get("series")).toBeNull();
    expect(search().get("tab")).toBe("graph");
  });

  it("keeps a subscriptions tab when the schedule sheet closes", async () => {
    await renderAt("/timeline?sheet=schedule&tab=published");
    await closeSheet();

    expect(search().get("sheet")).toBeNull();
    expect(search().get("tab")).toBe("published");
  });

  it("clears only the subscriptions tab when that sheet closes", async () => {
    await renderAt("/timeline?sheet=subscriptions&tab=published&series=series-1");
    await closeSheet();

    expect(search().get("sheet")).toBeNull();
    expect(search().get("series")).toBeNull();
    expect(search().get("tab")).toBeNull();
  });

  it("does not clear a task graph tab when the subscriptions sheet closes", async () => {
    await renderAt("/timeline?sheet=subscriptions&tab=graph");
    await closeSheet();

    expect(search().get("sheet")).toBeNull();
    expect(search().get("tab")).toBe("graph");
  });
});
