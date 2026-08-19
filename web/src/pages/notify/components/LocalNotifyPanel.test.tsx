import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFY_SETTINGS } from "../../../domain/notify/scanner/settings";
import { LocalNotifyPanel } from "./LocalNotifyPanel";

const update = vi.fn();
const { setVoiceEnabled, setFlashEnabled, setFlashMode } = vi.hoisted(() => ({
  setVoiceEnabled: vi.fn(),
  setFlashEnabled: vi.fn(),
  setFlashMode: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../hooks/useNotifyChannelSettings", () => ({
  useNotifyChannelSettings: () => ({
    voiceEnabled: true,
    flashEnabled: true,
    flashMode: "timed",
    setVoiceEnabled,
    setFlashEnabled,
    setFlashMode,
  }),
}));

vi.mock("../hooks/useLocalNotifyPanelState", () => ({
  useLocalNotifyPanelState: () => ({
    settings: mockSettings,
    update,
    previewing: false,
    handlePreview: vi.fn(),
  }),
}));

let mockSettings = {
  ...DEFAULT_NOTIFY_SETTINGS,
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
};

async function renderPanel(rootHolder: { current: Root | null }): Promise<HTMLDivElement> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    rootHolder.current = createRoot(host);
    rootHolder.current.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
  });
  return host;
}

describe("LocalNotifyPanel", () => {
  const rootHolder = { current: null as Root | null };

  beforeEach(() => {
    update.mockClear();
    setVoiceEnabled.mockClear();
    setFlashEnabled.mockClear();
    setFlashMode.mockClear();
    rootHolder.current = null;
  });

  afterEach(() => {
    act(() => {
      rootHolder.current?.unmount();
    });
    rootHolder.current = null;
    document.body.innerHTML = "";
    mockSettings = {
      ...DEFAULT_NOTIFY_SETTINGS,
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    };
  });

  it("shows OvernightClockHint when quiet end is before start", async () => {
    const host = await renderPanel(rootHolder);

    const hint = host.querySelector('[data-testid="voice-quiet-overnight-hint"]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("overnightClockHint");
  });

  it("hides OvernightClockHint for same-day quiet hours", async () => {
    mockSettings = {
      ...DEFAULT_NOTIFY_SETTINGS,
      quietHours: { enabled: true, start: "09:00", end: "17:00" },
    };
    const host = await renderPanel(rootHolder);

    expect(host.querySelector('[data-testid="voice-quiet-overnight-hint"]')).toBeNull();
  });

  it("shows independent voice and flash checkboxes", async () => {
    const host = await renderPanel(rootHolder);

    const voice = host.querySelector('[data-testid="notify-channel-voice"]');
    const flash = host.querySelector('[data-testid="notify-channel-flash"]');
    expect(voice?.getAttribute("aria-checked")).toBe("true");
    expect(flash?.getAttribute("aria-checked")).toBe("true");
    await act(async () => {
      (voice as HTMLButtonElement).click();
    });
    expect(setVoiceEnabled).toHaveBeenCalledWith(false);
    expect(setFlashEnabled).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ voiceEnabled: expect.anything() }));
  });

  it("lets the notifications page choose timed flash vs persistent", async () => {
    const host = await renderPanel(rootHolder);

    const mode = host.querySelector('[data-testid="notify-flash-mode"]');
    const persistent = Array.from(mode?.querySelectorAll('[role="tab"]') ?? []).find(
      (node) => node.textContent === "voice.flashModePersistent",
    );
    expect(mode).not.toBeNull();
    expect(persistent).not.toBeUndefined();
    await act(async () => {
      (persistent as HTMLButtonElement).click();
    });
    expect(setFlashMode).toHaveBeenCalledWith("persistent");
    expect(setFlashEnabled).not.toHaveBeenCalled();
  });

  it("adds a custom 30-minute lead to prefs", async () => {
    const host = await renderPanel(rootHolder);

    const input = host.querySelector('[data-testid="voice-lead-minutes-input"]') as HTMLInputElement;
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      nativeInputValueSetter.call(input, "30");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      (host.querySelector('[data-testid="voice-lead-add"]') as HTMLButtonElement).click();
    });
    expect(update).toHaveBeenCalledWith({ leadOffsetsMinutes: [30, 60] });
  });

  it("shows a stored custom 30-minute lead chip", async () => {
    mockSettings = {
      ...DEFAULT_NOTIFY_SETTINGS,
      leadOffsetsMinutes: [30, 60],
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    };
    const host = await renderPanel(rootHolder);

    expect(host.querySelector('[data-testid="voice-lead-chip-30"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="voice-lead-preset-60"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
  });

  it("toggles a common preset into lead offsets", async () => {
    const host = await renderPanel(rootHolder);

    await act(async () => {
      (host.querySelector('[data-testid="voice-lead-preset-15"]') as HTMLButtonElement).click();
    });
    expect(update).toHaveBeenCalledWith({ leadOffsetsMinutes: [15, 60] });
  });
});
