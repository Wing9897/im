import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeCalendarIdentity } from "../domain/calendarShare/subscribedCalendars";
import { i18n, wrapWithI18n } from "../test/i18nHarness";
import { setAppLocale } from "../i18n/locale";
import { SourceFilterDialog } from "./SourceFilterDialog";

const WORKSETS = [
  { id: "__general__", name: "General", cover: "" },
  { id: "ws-1", name: "Ops", cover: "data:image/jpeg;base64,x" },
];

const SUBSCRIBE = [
  subscribeCalendarIdentity({ handle: "Alice", slug: "Work", ownerAvatar: "data:image/png;base64,a" }),
];

describe("SourceFilterDialog board subscribe section", () => {
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
    document.querySelectorAll('[data-testid="source-filter-dialog"]').forEach((node) => node.remove());
  });

  it("stacks a compact subscribe group when catalog calendars exist", () => {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(MemoryRouter, null,
            createElement(SourceFilterDialog, {
              tasks: [],
              worksets: WORKSETS,
              selection: null,
              onChange: vi.fn(),
              variant: "board",
              subscribeCalendars: SUBSCRIBE,
              selectedSubscribeKeys: null,
              onChangeSubscribeKeys: vi.fn(),
            }),
          ),
        ),
      );
    });
    act(() => {
      (container.querySelector('[data-testid="board-source-filter"]') as HTMLButtonElement).click();
    });
    expect(document.querySelector('[data-testid="source-filter-workset-cover-ws-1"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-subscribe-filter"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-filter-subscribe-scroll"]')).toBeTruthy();
  });
});
