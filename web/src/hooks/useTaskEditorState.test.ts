import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useTaskEditorState, DEFAULT_FORM_STATE } from "./useTaskEditorState";
import type { TaskFormState, UseTaskEditorStateReturn } from "./useTaskEditorState";
import type { TaskTemplatePreset } from "../types";

// ============================================================
// Test harness — captures hook return value for assertions
// ============================================================

let latest: UseTaskEditorStateReturn;

function Harness({ isSaving }: { isSaving?: boolean }) {
  latest = useTaskEditorState({ isSaving });
  return null;
}

let container: HTMLElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function renderHarness(props: { isSaving?: boolean } = {}) {
  act(() => { root.render(createElement(Harness, props)); });
}

// ============================================================
// Tests
// ============================================================

describe("useTaskEditorState", () => {
  it("initializes with default form state", () => {
    renderHarness();
    expect(latest.formState).toEqual(DEFAULT_FORM_STATE);
  });

  it("updateField updates a single field", () => {
    renderHarness();

    act(() => { latest.updateField("name", "Test Task"); });

    expect(latest.formState.name).toBe("Test Task");
    expect(latest.formState.description).toBe("");
    expect(latest.formState.promptTemplate).toBe("");
  });

  it("updateField updates channelIds", () => {
    renderHarness();

    act(() => { latest.updateField("channelIds", ["ch1", "ch2"]); });

    expect(latest.formState.channelIds).toEqual(["ch1", "ch2"]);
  });

  it("applyPreset updates form fields from preset", () => {
    renderHarness();

    const preset: TaskTemplatePreset = {
      id: "preset-1",
      name: "Preset Name",
      description: "Preset Description",
      promptTemplate: "Analyze {{messages}}",
      analysisMode: "leaderboard",
      defaultAnalysisTimeRange: "7d",
      badge: "trending",
    };

    act(() => { latest.applyPreset(preset); });

    expect(latest.formState.name).toBe("Preset Name");
    expect(latest.formState.description).toBe("Preset Description");
    expect(latest.formState.promptTemplate).toBe("Analyze {{messages}}");
    expect(latest.formState.analysisMode).toBe("leaderboard");
    expect(latest.formState.analysisTimeRange).toBe("7d");
    expect(latest.formState.outputAnalysisEvents).toBe(false);
    // Fields not in preset remain at defaults
    expect(latest.formState.channelIds).toEqual([]);
    expect(latest.formState.scheduleType).toBe("seconds_10");
  });

  it("applyPreset for 對帳日曆 templates fills calendar caps and hourly schedule", () => {
    renderHarness();
    act(() => {
      latest.updateField("channelIds", ["ch-1"]);
    });

    const preset: TaskTemplatePreset = {
      id: "agent-work-shift",
      name: "工作輪更",
      description: "desc",
      promptTemplate: "把值班寫進我的日程",
      analysisMode: "agent",
      defaultAnalysisTimeRange: "7d",
      badge: "🕒",
    };

    act(() => {
      latest.applyPreset(preset);
    });

    expect(latest.formState.analysisMode).toBe("agent");
    expect(latest.formState.name).toBe("工作輪更");
    expect(latest.formState.triggerMode).toBe("message_cursor");
    expect(latest.formState.outputCalendar).toBe(true);
    expect(latest.formState.outputAnalysisEvents).toBe(false);
    expect(latest.formState.capWebSearch).toBe(false);
    expect(latest.formState.capCalendarWrites).toBe(true);
    expect(latest.formState.channelIds).toEqual(["ch-1"]);
    expect(latest.formState.scheduleType).toBe("hourly");
    expect(latest.formState.promptTemplate).toContain("值班");
  });

  it("applyPreset for 專案日程 uses the same 對帳日曆 caps", () => {
    renderHarness();

    const preset: TaskTemplatePreset = {
      id: "agent-project-schedule",
      name: "專案日程",
      description: "desc",
      promptTemplate: "地基裝修寫進日程，不要宣稱甘特依賴",
      analysisMode: "agent",
      defaultAnalysisTimeRange: "7d",
      badge: "📅",
    };

    act(() => {
      latest.applyPreset(preset);
    });

    expect(latest.formState.name).toBe("專案日程");
    expect(latest.formState.triggerMode).toBe("message_cursor");
    expect(latest.formState.outputCalendar).toBe(true);
    expect(latest.formState.capWebSearch).toBe(false);
    expect(latest.formState.promptTemplate).toContain("甘特");
  });

  it("applyPreset for 來源核實 fills web_scout caps and keeps sources", () => {
    renderHarness();
    act(() => {
      latest.updateField("channelIds", ["ch-1"]);
    });

    const preset: TaskTemplatePreset = {
      id: "agent-source-verify",
      name: "來源核實",
      description: "desc",
      promptTemplate: "用已綁來源當線索再 web.search",
      analysisMode: "agent",
      defaultAnalysisTimeRange: "1d",
      badge: "✅",
    };

    act(() => {
      latest.applyPreset(preset);
    });

    expect(latest.formState.analysisMode).toBe("agent");
    expect(latest.formState.name).toBe("來源核實");
    expect(latest.formState.triggerMode).toBe("message_threshold");
    expect(latest.formState.capWebSearch).toBe(true);
    expect(latest.formState.capForceWebSearch).toBe(true);
    expect(latest.formState.outputAnalysisEvents).toBe(true);
    expect(latest.formState.outputCalendar).toBe(false);
    expect(latest.formState.channelIds).toEqual(["ch-1"]);
    expect(latest.formState.scheduleType).toBe("hourly");
  });

  it("applyPreset for 純網搜 fills search caps, hourly schedule, and clears sources", () => {
    renderHarness();
    act(() => {
      latest.updateField("channelIds", ["ch-1"]);
    });

    const preset: TaskTemplatePreset = {
      id: "agent-pure-web-search",
      name: "純網搜",
      description: "desc",
      promptTemplate: "Use web.search",
      analysisMode: "agent",
      defaultAnalysisTimeRange: "1d",
      badge: "🔎",
    };

    act(() => {
      latest.applyPreset(preset);
    });

    expect(latest.formState.analysisMode).toBe("agent");
    expect(latest.formState.triggerMode).toBe("schedule");
    expect(latest.formState.capWebSearch).toBe(true);
    expect(latest.formState.capForceWebSearch).toBe(true);
    expect(latest.formState.outputAnalysisEvents).toBe(true);
    expect(latest.formState.outputCalendar).toBe(false);
    expect(latest.formState.channelIds).toEqual([]);
    expect(latest.formState.scheduleType).toBe("hourly");
    expect(latest.formState.promptTemplate).toContain("web.search");
    expect(latest.formState.name).toBe("純網搜");
  });

  describe("canSave", () => {
    it("returns false when form is empty", () => {
      renderHarness();
      expect(latest.canSave).toBe(false);
    });

    it("defaults to intel_event and returns false when only name is set", () => {
      renderHarness();
      expect(latest.formState.analysisMode).toBe("intel_event");
      act(() => { latest.updateField("name", "My Task"); });
      expect(latest.canSave).toBe(false);
    });

    it("returns false when name and promptTemplate are set but no channels (AI mode)", () => {
      renderHarness();
      act(() => {
        latest.updateField("analysisMode", "leaderboard");
        latest.updateField("name", "My Task");
        latest.updateField("promptTemplate", "Analyze this");
      });
      expect(latest.canSave).toBe(false);
    });

    it("returns true when name, promptTemplate, and channels are set (AI mode)", () => {
      renderHarness();
      act(() => {
        latest.updateField("analysisMode", "leaderboard");
        latest.updateField("name", "My Task");
        latest.updateField("promptTemplate", "Analyze this");
        latest.updateField("channelIds", ["ch1"]);
      });
      expect(latest.canSave).toBe(true);
    });

    it("returns false when isSaving is true", () => {
      renderHarness({ isSaving: true });
      act(() => {
        latest.updateField("analysisMode", "leaderboard");
        latest.updateField("name", "My Task");
        latest.updateField("promptTemplate", "Analyze this");
        latest.updateField("channelIds", ["ch1"]);
      });
      expect(latest.canSave).toBe(false);
    });

    it("requires prompt for agent; schedule needs no sources, threshold does", () => {
      renderHarness();
      act(() => {
        latest.updateField("analysisMode", "agent");
        latest.updateField("name", "Agent scout");
        latest.updateField("channelIds", []);
        latest.updateField("outputAnalysisEvents", true);
        latest.updateField("outputCalendar", false);
        latest.updateField("triggerMode", "schedule");
      });
      expect(latest.canSave).toBe(false);
      expect(latest.saveBlockReason).toMatch(/Prompt|prompt/i);

      act(() => {
        latest.updateField("promptTemplate", "Extract official notes");
      });
      expect(latest.canSave).toBe(true);
      expect(latest.saveBlockReason).toBeNull();

      act(() => {
        latest.updateField("triggerMode", "message_threshold");
      });
      expect(latest.canSave).toBe(false);
      expect(latest.saveBlockReason).toMatch(/來源|channel/i);
    });

    it("blocks message_cursor combined with outputAnalysisEvents", () => {
      renderHarness();
      act(() => {
        latest.updateField("analysisMode", "agent");
        latest.updateField("name", "Agent reconcile");
        latest.updateField("promptTemplate", "Keep calendar current");
        latest.updateField("channelIds", ["ch-1"]);
        latest.updateField("triggerMode", "message_cursor");
        latest.updateField("outputCalendar", true);
        latest.updateField("outputAnalysisEvents", true);
      });
      expect(latest.canSave).toBe(false);
      expect(latest.saveBlockReason).toMatch(/cursor|intelligence|情報|情报/i);
    });
  });

  it("setFormState allows direct state replacement", () => {
    renderHarness();

    const newState: TaskFormState = {
      ...DEFAULT_FORM_STATE,
      name: "Loaded Task",
      description: "From DB",
      promptTemplate: "Do analysis",
      channelIds: ["ch1", "ch2"],
    };

    act(() => { latest.setFormState(newState); });

    expect(latest.formState).toEqual(newState);
  });
});
