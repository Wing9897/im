import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendRecentInbox,
  loadRecentInbox,
  resetRecentInboxForTests,
  setRecentInboxOpen,
  unreadRecentInboxCount,
} from "../../domain/notify/recentInbox";
import { RecentDayInboxDrawer } from "./RecentDayInboxDrawer";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../hooks/useNotifyChannelSettings", () => ({
  useNotifyChannelSettings: () => ({
    voiceEnabled: true,
    flashEnabled: false,
    setVoiceEnabled: vi.fn(),
    setFlashEnabled: vi.fn(),
  }),
}));

describe("RecentDayInboxDrawer", () => {
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    resetRecentInboxForTests();
  });

  async function renderDrawer(): Promise<void> {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(RecentDayInboxDrawer));
    });
  }

  function seedTwo(now: number): void {
    appendRecentInbox(
      {
        dedupeKey: "e1::60",
        eventId: "e1",
        title: "Standup",
        startTime: new Date(now + 60 * 60_000).toISOString(),
        remindAtMs: now,
      },
      now,
    );
    appendRecentInbox(
      {
        dedupeKey: "e2::60",
        eventId: "e2",
        title: "Retro",
        startTime: new Date(now + 2 * 60 * 60_000).toISOString(),
        remindAtMs: now,
      },
      now,
    );
  }

  it("renders rolling-24h entries in a right drawer, not a top banner", async () => {
    const now = Date.now();
    appendRecentInbox(
      {
        dedupeKey: "e1::60",
        eventId: "e1",
        title: "Standup",
        startTime: new Date(now + 60 * 60_000).toISOString(),
        remindAtMs: now,
      },
      now,
    );
    setRecentInboxOpen(true);

    await renderDrawer();

    const drawer = document.body.querySelector('[data-testid="recent-day-inbox"]');
    expect(drawer).toBeTruthy();
    expect(drawer?.className).toContain("im-dialog-drawer");
    expect(document.body.querySelector('[data-testid="recent-day-inbox-item-e1"]')?.textContent).toContain(
      "Standup",
    );
    expect(document.body.querySelector('[data-testid="drawer-channel-voice"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="drawer-channel-flash"]')).toBeTruthy();
    expect(document.body.querySelector('[data-testid="recent-day-banner"]')).toBeNull();
  });

  it("clears one row from the inbox without a confirm dialog", async () => {
    const now = Date.now();
    seedTwo(now);
    setRecentInboxOpen(true);
    await renderDrawer();

    const row = document.body.querySelector('[data-testid="recent-day-inbox-item-e1"]');
    const clear = row?.querySelector<HTMLButtonElement>('[data-testid="recent-day-inbox-item-clear"]');
    expect(clear).toBeTruthy();
    expect(document.body.querySelector('[role="alertdialog"]')).toBeNull();

    await act(async () => {
      clear?.click();
    });

    expect(document.body.querySelector('[data-testid="recent-day-inbox-item-e1"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="recent-day-inbox-item-e2"]')?.textContent).toContain(
      "Retro",
    );
    expect(loadRecentInbox(now).map((entry) => entry.eventId)).toEqual(["e2"]);
  });

  it("one-click clear-all empties the list and badge, and hides the toolbar when empty", async () => {
    const now = Date.now();
    seedTwo(now);
    setRecentInboxOpen(true);
    await renderDrawer();

    const clearAll = document.body.querySelector<HTMLButtonElement>(
      '[data-testid="recent-day-inbox-clear-all"]',
    );
    expect(clearAll).toBeTruthy();
    expect(document.body.querySelector('[data-testid="recent-day-inbox-toolbar"]')).toBeTruthy();

    await act(async () => {
      clearAll?.click();
    });

    expect(document.body.querySelector('[data-testid="recent-day-inbox-item-e1"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="recent-day-inbox-item-e2"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="recent-day-inbox-clear-all"]')).toBeNull();
    expect(document.body.textContent).toContain("notify.inboxEmpty");
    expect(loadRecentInbox(now)).toEqual([]);
    expect(unreadRecentInboxCount(now)).toBe(0);
  });
});
