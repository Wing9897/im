import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VOICE_REMINDER_SETTINGS } from "../../voiceReminder/settings";
import { VoiceReminderPanel } from "./VoiceReminderPanel";

const update = vi.fn();

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./useVoiceReminderPanelState", () => ({
  useVoiceReminderPanelState: () => ({
    settings: mockSettings,
    update,
    toggleLead: vi.fn(),
    previewing: false,
    handlePreview: vi.fn(),
    tasksLoading: false,
    filterTasks: [],
    filterWorksets: [],
    expandTasks: [],
    setSourceFilter: vi.fn(),
  }),
}));

vi.mock("./VoiceReminderSourcesSection", () => ({
  VoiceReminderSourcesSection: () => null,
}));

let mockSettings = {
  ...DEFAULT_VOICE_REMINDER_SETTINGS,
  quietHours: { enabled: true, start: "22:00", end: "07:00" },
};

describe("VoiceReminderPanel quiet hours overnight", () => {
  let root: Root | null = null;

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
      root.render(createElement(MemoryRouter, null, createElement(VoiceReminderPanel)));
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
      root.render(createElement(MemoryRouter, null, createElement(VoiceReminderPanel)));
    });

    expect(host.querySelector('[data-testid="voice-quiet-overnight-hint"]')).toBeNull();
  });
});
