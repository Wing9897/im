import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeTimelineItem } from "../../test/analysisEventFixtures";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";
import { EventListRow } from "./EventListRow";

describe("EventListRow", () => {
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
    act(() => root.unmount());
    container.remove();
  });

  it("renders title, affiliation, time, and dismiss for local events", () => {
    const onDismiss = vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(EventListRow, {
            event: makeTimelineItem({
              id: "evt-1",
              title: "Standup",
              source: "user",
              worksetId: "__general__",
            }),
            metaLookups: { generalWorksetLabel: "General" },
            onDismiss,
            testId: "board-event-row",
          }),
        ),
      );
    });
    expect(container.textContent).toContain("Standup");
    expect(container.querySelector('[data-testid="board-event-list-affiliation"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-event-list-time"]')).toBeTruthy();
    act(() => {
      (container.querySelector('[data-testid="board-event-dismiss-evt-1"]') as HTMLButtonElement).click();
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("hides dismiss for subscribed events", () => {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(EventListRow, {
            event: makeTimelineItem({ source: "subscribed:Alice/Work", title: "Shared" }),
            metaLookups: {},
            onDismiss: vi.fn(),
          }),
        ),
      );
    });
    expect(container.querySelector('[data-testid^="board-event-dismiss-"]')).toBeNull();
  });
});
