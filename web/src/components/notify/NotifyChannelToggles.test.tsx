import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_NOTIFY_SETTINGS,
  saveNotifySettings,
} from "../../domain/notify/scanner/settings";
import { resetNotifySettingsCacheForTests } from "../../domain/notify/scanner/settings.testing";
import { NotifyChannelToggles } from "./NotifyChannelToggles";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../domain/notify/scanner/settings", async () => {
  const actual = await vi.importActual<
    typeof import("../../domain/notify/scanner/settings")
  >("../../domain/notify/scanner/settings");
  return {
    ...actual,
    hydrateNotifySettings: () => Promise.resolve(actual.loadNotifySettings()),
    saveNotifySettings: vi.fn(async (settings: unknown) => {
      await actual.saveNotifySettings(settings as never);
      return true;
    }),
  };
});

const { mockPutSettings } = vi.hoisted(() => ({
  mockPutSettings: vi.fn(),
}));

vi.mock("../../api/uiPrefs", () => ({
  fetchNotifySettings: vi.fn(async () => ({
    configured: false,
    settings: null,
  })),
  putNotifySettings: (...args: unknown[]) => mockPutSettings(...args),
}));

describe("NotifyChannelToggles", () => {
  let root: Root | null = null;

  beforeEach(async () => {
    resetNotifySettingsCacheForTests();
    mockPutSettings.mockReset();
    mockPutSettings.mockImplementation(async (settings: unknown) => ({
      configured: true,
      settings,
    }));
    await saveNotifySettings({
      ...DEFAULT_NOTIFY_SETTINGS,
      enabled: true,
      voiceEnabled: true,
      flashEnabled: true,
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    resetNotifySettingsCacheForTests();
  });

  it("toggles voice without changing flash", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(NotifyChannelToggles, {
          variant: "icons",
          testIdPrefix: "chrome",
        }),
      );
    });

    const voice = host.querySelector<HTMLButtonElement>(
      '[data-testid="chrome-channel-voice"]',
    );
    const flash = host.querySelector<HTMLButtonElement>(
      '[data-testid="chrome-channel-flash"]',
    );
    expect(voice?.getAttribute("aria-pressed")).toBe("true");
    expect(flash?.getAttribute("aria-pressed")).toBe("true");
    expect(flash?.getAttribute("aria-label")).toBe("notify.channelFlashAria");
    expect(flash?.getAttribute("title")).toBe("notify.channelFlash");

    await act(async () => {
      voice!.click();
    });

    const last = mockPutSettings.mock.calls.at(-1)?.[0] as {
      voiceEnabled: boolean;
      flashEnabled: boolean;
    };
    expect(last.voiceEnabled).toBe(false);
    expect(last.flashEnabled).toBe(true);
  });

  it("renders labeled tiles on the notifications page", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(NotifyChannelToggles, {
          variant: "tiles",
          testIdPrefix: "notify",
        }),
      );
    });

    const voice = host.querySelector<HTMLButtonElement>(
      '[data-testid="notify-channel-voice"]',
    );
    const flash = host.querySelector<HTMLButtonElement>(
      '[data-testid="notify-channel-flash"]',
    );
    expect(voice?.getAttribute("role")).toBe("switch");
    expect(voice?.className).toContain("im-surface-inset");
    expect(flash?.getAttribute("aria-checked")).toBe("true");
    expect(flash?.getAttribute("aria-label")).toBe("notify.channelFlashAria");
    expect(flash?.textContent).toBe("notify.channelFlash");

    await act(async () => {
      voice!.click();
    });

    const last = mockPutSettings.mock.calls.at(-1)?.[0] as {
      voiceEnabled: boolean;
      flashEnabled: boolean;
      flashMode: string;
    };
    expect(last.voiceEnabled).toBe(false);
    expect(last.flashEnabled).toBe(true);
    expect(last.flashMode).toBe("timed");
  });

  it("persists flash presentation independently of the flash channel", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(NotifyChannelToggles, {
          variant: "tiles",
          testIdPrefix: "notify",
        }),
      );
    });

    const mode = host.querySelector('[data-testid="notify-flash-mode"]');
    const persistent = Array.from(
      mode?.querySelectorAll('[role="tab"]') ?? [],
    ).find((node) => node.textContent === "voice.flashModePersistent");
    expect(persistent).not.toBeUndefined();
    await act(async () => {
      (persistent as HTMLButtonElement).click();
    });

    const last = mockPutSettings.mock.calls.at(-1)?.[0] as {
      flashEnabled: boolean;
      flashMode: string;
    };
    expect(last.flashEnabled).toBe(true);
    expect(last.flashMode).toBe("persistent");
  });

  it("labels the on-screen channel in the drawer chips", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(NotifyChannelToggles, {
          variant: "labeled",
          testIdPrefix: "drawer",
        }),
      );
    });

    const flash = host.querySelector<HTMLButtonElement>(
      '[data-testid="drawer-channel-flash"]',
    );
    expect(flash?.getAttribute("aria-label")).toBe("notify.channelFlashAria");
    expect(flash?.getAttribute("title")).toBe("notify.channelFlash");
    expect(flash?.textContent).toContain("notify.channelFlash");
  });
});
