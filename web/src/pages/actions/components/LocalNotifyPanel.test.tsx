import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VOICE_REMINDER_SETTINGS } from "../../../domain/notify/scanner/settings";
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
  ...DEFAULT_VOICE_REMINDER_SETTINGS,
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
};

describe("LocalNotifyPanel", () => {
  let root: Root | null = null;

  beforeEach(() => {
    update.mockClear();
    setVoiceEnabled.mockClear();
    setFlashEnabled.mockClear();
    setFlashMode.mockClear();
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    mockSettings = {
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    };
  });

  it("shows OvernightClockHint when quiet end is before start", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const hint = host.querySelector('[data-testid="voice-quiet-overnight-hint"]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("overnightClockHint");
  });

  it("hides OvernightClockHint for same-day quiet hours", async () => {
    mockSettings = {
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      quietHours: { enabled: true, start: "09:00", end: "17:00" },
    };
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    expect(host.querySelector('[data-testid="voice-quiet-overnight-hint"]')).toBeNull();
  });

  it("does not show a worksets hub link", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    expect(host.querySelector('[data-testid="workset-hub-link"]')).toBeNull();
    expect(host.textContent).not.toContain("voice.worksetsCaption");
    expect(host.textContent).not.toContain("voice.worksetsHubLink");
    expect(host.textContent).not.toContain("voice.sectionWorksets");
  });

  it("shows independent voice and flash checkboxes", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const voice = host.querySelector('[data-testid="voice-reminder-channel-voice"]');
    const flash = host.querySelector('[data-testid="voice-reminder-channel-flash"]');
    expect(voice?.getAttribute("aria-checked")).toBe("true");
    expect(flash?.getAttribute("aria-checked")).toBe("true");
    expect(flash?.textContent).toContain("notify.channelFlash");
    expect(flash?.getAttribute("aria-label")).toBe("notify.channelFlashAria");
    await act(async () => {
      (voice as HTMLButtonElement).click();
    });
    expect(setVoiceEnabled).toHaveBeenCalledWith(false);
    expect(setFlashEnabled).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalledWith(expect.objectContaining({ voiceEnabled: expect.anything() }));
  });

  it("lets the notifications page choose timed flash vs persistent", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const mode = host.querySelector('[data-testid="voice-reminder-flash-mode"]');
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

  it("shows per-section captions instead of overlay or bullet-list help", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    expect(host.querySelector('[data-testid="info-tooltip"]')).toBeNull();
    expect(host.querySelector("ul")).toBeNull();
    expect(host.textContent).toContain("voice.caption");
    expect(host.textContent).toContain("voice.channelsCaption");
    expect(host.textContent).toContain("voice.flashModeCaption");
    expect(host.textContent).toContain("voice.leadCaption");
    expect(host.textContent).toContain("voice.quietCaption");
    expect(host.textContent).toContain("voice.preambleCaption");
  });

  it("places the master switch on the title row with AI voice link", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const header = host.querySelector('[data-testid="voice-header"]');
    const enable = header?.querySelector('[data-testid="voice-reminder-enabled"]');
    expect(header?.querySelector("h2")).not.toBeNull();
    expect(enable).not.toBeNull();
    expect(enable?.getAttribute("role")).toBe("switch");
    expect(enable?.className).toContain("border-0");
    expect(enable?.className).toContain("p-0");
    expect(enable?.className).toContain("bg-transparent");
    expect(enable?.className).toContain("shadow-none");
    expect(enable?.className).toContain("appearance-none");
    expect(enable?.className).not.toContain("im-surface-inset");
    expect(enable?.className).not.toContain("border-accent");
    expect(enable?.className).toContain("focus-visible:ring-2");
    expect(enable?.className).toContain("rounded-full");
    expect(enable?.textContent).not.toContain("voice.enableLabel");
    expect(enable?.closest("label")?.className).not.toContain("im-surface-inset");
    expect(enable?.closest("label")?.className).toContain("border-0");
    expect(enable?.closest('[role="region"]')).toBeNull();
    expect(header?.querySelector('a[href="/ai/voice"]')).not.toBeNull();
  });

  it("uses standard tiles and language-style lead pills", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const enable = host.querySelector('[data-testid="voice-reminder-enabled"]');
    const channels = host.querySelector('[data-testid="voice-channel-toggles"]');
    expect(enable).not.toBeNull();
    expect(channels).not.toBeNull();
    expect(enable?.parentElement).not.toBe(channels);
    expect(enable?.className).not.toContain("im-surface-inset");
    expect(enable?.closest("label")?.textContent).toContain("voice.enableLabel");
    expect(channels?.querySelector(".im-surface-inset")).not.toBeNull();
    expect(channels?.querySelector('[data-testid="voice-reminder-flash-mode"]')).not.toBeNull();
    expect(channels?.textContent).toContain("voice.flashModeTimed");
    expect(channels?.textContent).toContain("voice.flashModePersistent");
    expect(channels?.closest('[role="region"]')).not.toBeNull();
    expect(channels?.textContent).not.toContain("voice.channelVoiceHint");
    expect(channels?.textContent).not.toContain("voice.channelFlashHint");

    const leadRow = host.querySelector('[data-testid="voice-lead-row"]');
    expect(leadRow?.querySelector('[data-testid="voice-lead-minutes-input"]')).not.toBeNull();
    expect(leadRow?.querySelector('[data-testid="voice-lead-preset-15"]')).not.toBeNull();
    expect(leadRow?.className).toContain("flex-wrap");
    expect(host.querySelector('[data-testid="voice-lead-chips"]')).toBeNull();
    expect(host.querySelector('[data-testid="voice-lead-chip-60"]')).toBeNull();
    expect(host.querySelector('[data-testid="voice-lead-preset-60"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(host.querySelector('[data-testid="voice-lead-preset-15"]')?.getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("places preamble after quiet hours", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const sectionIds = [
      "voice-reminder-enabled",
      "voice-channel-toggles",
      "voice-lead-offsets",
      "voice-quiet-controls",
      "voice-preamble",
    ];
    const nodes = sectionIds.map((id) => host.querySelector(`[data-testid="${id}"]`));
    expect(nodes.every((node) => node !== null)).toBe(true);
    expect(host.querySelector('[data-testid="workset-hub-link"]')).toBeNull();
    for (let i = 1; i < nodes.length; i += 1) {
      const prev = nodes[i - 1]!;
      const next = nodes[i]!;
      expect(prev.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("keeps quiet-hours switch beside time fields", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const row = host.querySelector('[data-testid="voice-quiet-controls"]');
    expect(row?.querySelector('[data-testid="voice-reminder-quiet-hours-enabled"]')).not.toBeNull();
    expect(row?.querySelectorAll('input[type="time"]')).toHaveLength(2);
    await act(async () => {
      const master = host.querySelector('[data-testid="voice-reminder-enabled"]') as HTMLButtonElement;
      master.click();
    });
    expect(update).toHaveBeenCalledWith({ enabled: true });
  });

  it("adds a custom 30-minute lead to prefs", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

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
      ...DEFAULT_VOICE_REMINDER_SETTINGS,
      leadOffsetsMinutes: [30, 60],
      quietHours: { enabled: true, start: "22:00", end: "07:00" },
    };
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    expect(host.querySelector('[data-testid="voice-lead-chip-30"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="voice-lead-chip-60"]')).toBeNull();
    expect(host.querySelector('[data-testid="voice-lead-preset-60"]')?.getAttribute("aria-pressed")).toBe(
      "true",
    );
    const leadRow = host.querySelector('[data-testid="voice-lead-row"]');
    expect(leadRow?.querySelector('[data-testid="voice-lead-chip-30"]')).not.toBeNull();
    expect(leadRow?.querySelector('[data-testid="voice-lead-minutes-input"]')).not.toBeNull();
  });

  it("toggles a common preset into lead offsets", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    await act(async () => {
      (host.querySelector('[data-testid="voice-lead-preset-15"]') as HTMLButtonElement).click();
    });
    expect(update).toHaveBeenCalledWith({ leadOffsetsMinutes: [15, 60] });
    const input = host.querySelector('[data-testid="voice-lead-minutes-input"]') as HTMLInputElement;
    expect(input.value).toBe("");
  });

  it("keeps preview flush against the preamble dropdown", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(MemoryRouter, null, createElement(LocalNotifyPanel)));
    });

    const preamble = host.querySelector('[data-testid="voice-preamble"]');
    const preview = host.querySelector('[data-testid="voice-preamble-preview"]');
    expect(preamble?.className).toContain("gap-sm");
    expect(preamble?.className).not.toContain("ml-auto");
    expect(preview?.className).not.toContain("ml-auto");
    expect(preview?.parentElement).toBe(preamble);
  });
});
