import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VOICE_REMINDER_SETTINGS,
  resetVoiceReminderSettingsCacheForTests,
  saveVoiceReminderSettings,
} from "../../domain/notify/scanner/settings";
import { resetNotifyFlashForTests, showNotifyFlash } from "../../domain/notify/notifyFlash";
import { NotifyFlashHost } from "./NotifyFlashHost";

const { mockIsElectronDesktop } = vi.hoisted(() => ({
  mockIsElectronDesktop: vi.fn(() => false),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../electron/electronWindow", () => ({
  isElectronDesktop: () => mockIsElectronDesktop(),
}));

vi.mock("../../domain/notify/scanner/settings", async () => {
  const actual = await vi.importActual<typeof import("../../domain/notify/scanner/settings")>(
    "../../domain/notify/scanner/settings",
  );
  return {
    ...actual,
    hydrateVoiceReminderSettings: () => Promise.resolve(actual.loadVoiceReminderSettings()),
    saveVoiceReminderSettings: vi.fn(async (settings: unknown) => {
      await actual.saveVoiceReminderSettings(settings as never);
      return true;
    }),
  };
});

const { mockPutSettings } = vi.hoisted(() => ({
  mockPutSettings: vi.fn(),
}));

vi.mock("../../api/uiPrefs", () => ({
  fetchVoiceReminderSettings: vi.fn(async () => ({ configured: false, settings: null })),
  putVoiceReminderSettings: (...args: unknown[]) => mockPutSettings(...args),
}));

describe("NotifyFlashHost", () => {
  let root: Root | null = null;

  beforeEach(async () => {
    mockIsElectronDesktop.mockReturnValue(false);
    resetVoiceReminderSettingsCacheForTests();
    mockPutSettings.mockReset();
    mockPutSettings.mockImplementation(async (settings: unknown) => ({
      configured: true,
      settings,
    }));
    await saveVoiceReminderSettings({
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      enabled: true,
      flashEnabled: true,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    resetNotifyFlashForTests();
    resetVoiceReminderSettingsCacheForTests();
  });

  it("renders a dedicated full-width top bar, not the operational toast container", async () => {
    showNotifyFlash("Standup in 1 hour");
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(NotifyFlashHost));
    });

    const stack = document.body.querySelector('[data-testid="notify-flash-stack"]');
    expect(stack).toBeTruthy();
    expect(stack?.className).toContain("im-notify-flash-stack");
    expect(stack?.className).toContain("top-0");
    expect(stack?.className).toContain("left-0");
    expect(stack?.className).toContain("right-0");
    expect(stack?.className).toContain("w-full");
    expect(stack?.className).not.toContain("bottom-2xl");
    expect(stack?.className).not.toContain("right-2xl");
    expect(stack?.getAttribute("data-desktop-offset")).toBe("false");
    expect(stack?.textContent).toContain("Standup in 1 hour");
    expect(document.body.querySelectorAll('[data-testid="notify-flash-item"]')).toHaveLength(1);
    expect(document.body.querySelector('[data-testid="notify-flash-fuse"]')).not.toBeNull();
    expect(document.body.querySelector('[role="alert"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="recent-day-banner"]')).toBeNull();
  });

  it("sits below the Electron title bar so window controls stay clear", async () => {
    mockIsElectronDesktop.mockReturnValue(true);
    showNotifyFlash("Desktop flash");
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(NotifyFlashHost));
    });

    const stack = document.body.querySelector('[data-testid="notify-flash-stack"]');
    expect(stack?.className).toContain("top-[var(--desktop-title-bar-height)]");
    expect(stack?.className).not.toContain("top-0");
    expect(stack?.getAttribute("data-desktop-offset")).toBe("true");
  });

  it("hides the bar when the flash channel is off", async () => {
    await saveVoiceReminderSettings({
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      flashEnabled: false,
    });
    showNotifyFlash("Should stay hidden");
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(NotifyFlashHost));
    });

    expect(document.body.querySelector('[data-testid="notify-flash-stack"]')).toBeNull();
  });

  it("replaces the current bar instead of stacking additional banners", async () => {
    showNotifyFlash("First");
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(NotifyFlashHost));
    });
    await act(async () => {
      showNotifyFlash("Second");
    });

    const items = document.body.querySelectorAll('[data-testid="notify-flash-item"]');
    expect(items).toHaveLength(1);
    expect(items[0]?.textContent).toContain("Second");
    expect(items[0]?.textContent).not.toContain("First");
    expect(document.body.querySelector('[data-testid="notify-flash-fuse"]')).not.toBeNull();
  });

  it("shows the fuse countdown only in timed flash mode", async () => {
    showNotifyFlash("Persistent bar", { persist: true });
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(NotifyFlashHost));
    });

    const item = document.body.querySelector('[data-testid="notify-flash-item"]');
    expect(item?.getAttribute("data-flash-persist")).toBe("true");
    expect(document.body.querySelector('[data-testid="notify-flash-fuse"]')).toBeNull();
  });
});
