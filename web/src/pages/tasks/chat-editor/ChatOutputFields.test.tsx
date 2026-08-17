import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatOutputFields } from "./ChatOutputFields";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../../test/i18nHarness";

function renderFields(
  container: HTMLElement,
  overrides: Partial<Parameters<typeof ChatOutputFields>[0]> = {},
) {
  const defaults: Parameters<typeof ChatOutputFields>[0] = {
    analysisMode: "intel_event",
    triggerMode: "schedule",
    outputAnalysisEvents: true,
    includeInTimeline: true,
    notifyPref: "follow",
    timelineToggleVisible: true,
    onOutputAnalysisEventsChange: vi.fn(),
    onIncludeInTimelineChange: vi.fn(),
    onNotifyPrefChange: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  act(() => {
    createRoot(container).render(wrapWithI18n(createElement(ChatOutputFields, props)));
  });
  return props;
}

describe("ChatOutputFields", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("groups intelligence, time planning, and notify for intel_event", () => {
    const container = document.createElement("div");
    renderFields(container);
    const root = container.querySelector('[data-testid="task-output-fields"]');
    expect(root).not.toBeNull();
    expect(root?.querySelector('[data-testid="task-output-analysis-events"]')).not.toBeNull();
    expect(root?.querySelector('[data-testid="task-include-in-timeline"]')).not.toBeNull();
    expect(root?.querySelector('[data-testid="notify-pref-field"]')).not.toBeNull();
    expect(root?.querySelector('[data-testid="task-agent-output-calendar"]')).toBeNull();
    expect(root?.textContent).toContain(String(i18n.t("notify.prefLabel")));
    expect(root?.textContent).not.toContain("提醒");
    expect(container.querySelector('[data-testid="task-output-intel-off-timeline-hint"]')).toBeNull();
  });

  it("hides time planning when timelineToggleVisible is false", () => {
    const container = document.createElement("div");
    renderFields(container, {
      analysisMode: "leaderboard",
      timelineToggleVisible: false,
    });
    expect(container.querySelector('[data-testid="task-include-in-timeline"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-output-analysis-events"]')).toBeNull();
    expect(container.querySelector('[data-testid="notify-pref-field"]')).not.toBeNull();
  });

  it("keeps time planning enabled and shows a hint when intelligence is off", () => {
    const container = document.createElement("div");
    renderFields(container, { outputAnalysisEvents: false, includeInTimeline: true });
    const timeline = container.querySelector(
      '[data-testid="task-include-in-timeline"]',
    ) as HTMLButtonElement;
    expect(timeline).not.toBeNull();
    expect(timeline.disabled).toBe(false);
    expect(timeline.getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-testid="task-output-intel-off-timeline-hint"]')?.textContent).toContain(
      String(i18n.t("tasks:editor.outputIntelOffTimelineHint")),
    );
  });

  it("disables intelligence when agent trigger is message_cursor", () => {
    const onChange = vi.fn();
    const container = document.createElement("div");
    renderFields(container, {
      analysisMode: "agent",
      triggerMode: "message_cursor",
      outputAnalysisEvents: true,
      onOutputAnalysisEventsChange: onChange,
    });
    const intel = container.querySelector(
      '[data-testid="task-output-analysis-events"]',
    ) as HTMLButtonElement;
    expect(intel.disabled).toBe(true);
    expect(intel.getAttribute("aria-checked")).toBe("false");
    act(() => {
      intel.click();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows agent calendar write in the output group", () => {
    const onCalendar = vi.fn();
    const container = document.createElement("div");
    renderFields(container, {
      analysisMode: "agent",
      triggerMode: "schedule",
      outputCalendar: false,
      onOutputCalendarChange: onCalendar,
    });
    const calendar = container.querySelector(
      '[data-testid="task-agent-output-calendar"]',
    ) as HTMLButtonElement;
    expect(calendar).not.toBeNull();
    expect(calendar.getAttribute("role")).toBe("switch");
    act(() => {
      calendar.click();
    });
    expect(onCalendar).toHaveBeenCalledWith(true);
  });

  it("reports intelligence and timeline toggles", () => {
    const container = document.createElement("div");
    const props = renderFields(container);
    const intel = container.querySelector(
      '[data-testid="task-output-analysis-events"]',
    ) as HTMLButtonElement;
    const timeline = container.querySelector(
      '[data-testid="task-include-in-timeline"]',
    ) as HTMLButtonElement;
    act(() => {
      intel.click();
      timeline.click();
    });
    expect(props.onOutputAnalysisEventsChange).toHaveBeenCalledWith(false);
    expect(props.onIncludeInTimelineChange).toHaveBeenCalledWith(false);
  });
});
