/**
 * Agent preset + trigger / capability fields for ChatEditorForm.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FORM_STATE } from "../../../hooks/useTaskEditorState";
import { ChatAgentPolicyFields } from "./ChatAgentPolicyFields";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

describe("ChatAgentPolicyFields", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("keeps mode cards, trigger radios, and caps without calendar output", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(ChatAgentPolicyFields, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "schedule",
              outputCalendar: false,
              outputAnalysisEvents: true,
            },
            updateField: () => undefined,
          }),
        ),
      );
    });
    expect(container.querySelector('[data-testid="task-agent-policy"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-mode-cards"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-mode-project_reconcile"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-mode-web_scout"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-mode-pure_web_search"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="task-agent-output-calendar"]')).toBeNull();
    expect(container.querySelector('[data-testid="task-agent-trigger"]')?.getAttribute("role")).toBe(
      "radiogroup",
    );
    expect(container.querySelector('[data-testid="task-agent-trigger-schedule"]')).not.toBeNull();
    expect(
      container.querySelector('[data-testid="task-agent-cap-calendar-read"]')?.getAttribute("role"),
    ).toBe("switch");
    expect(container.querySelector('[data-testid="task-agent-output-analysis"]')).toBeNull();
  });

  it("selects trigger mode via tile radios", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(ChatAgentPolicyFields, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "schedule",
              channelIds: ["ch-1"],
            },
            updateField,
          }),
        ),
      );
    });
    act(() => {
      (
        container.querySelector(
          '[data-testid="task-agent-trigger-message_cursor"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(updateField).toHaveBeenCalledWith("triggerMode", "message_cursor");
  });

  it("來源+網搜 card sets intelligence on, calendar off, and threshold trigger", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(ChatAgentPolicyFields, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "message_cursor",
              outputCalendar: true,
              outputAnalysisEvents: false,
              channelIds: [],
            },
            updateField,
          }),
        ),
      );
    });
    act(() => {
      (
        container.querySelector('[data-testid="task-agent-mode-web_scout"]') as HTMLButtonElement
      ).click();
    });
    expect(updateField).toHaveBeenCalledWith("triggerMode", "message_threshold");
    expect(updateField).toHaveBeenCalledWith("outputAnalysisEvents", true);
    expect(updateField).toHaveBeenCalledWith("outputCalendar", false);
    expect(updateField).toHaveBeenCalledWith("capWebSearch", true);
  });

  it("對帳日曆 card sets intelligence off and calendar on", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(ChatAgentPolicyFields, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "schedule",
              outputCalendar: false,
              outputAnalysisEvents: true,
              channelIds: ["ch-1"],
            },
            updateField,
          }),
        ),
      );
    });
    act(() => {
      (
        container.querySelector(
          '[data-testid="task-agent-mode-project_reconcile"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(updateField).toHaveBeenCalledWith("outputAnalysisEvents", false);
    expect(updateField).toHaveBeenCalledWith("outputCalendar", true);
    expect(updateField).toHaveBeenCalledWith("capWebSearch", false);
    expect(updateField).toHaveBeenCalledWith("triggerMode", "message_cursor");
  });

  it("純網搜 card sets schedule search, clears channels, and skips calendar", () => {
    const updateField = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(ChatAgentPolicyFields, {
            formState: {
              ...DEFAULT_FORM_STATE,
              analysisMode: "agent",
              triggerMode: "message_cursor",
              outputCalendar: true,
              outputAnalysisEvents: false,
              channelIds: ["ch-1"],
            },
            updateField,
          }),
        ),
      );
    });
    act(() => {
      (
        container.querySelector(
          '[data-testid="task-agent-mode-pure_web_search"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(updateField).toHaveBeenCalledWith("triggerMode", "schedule");
    expect(updateField).toHaveBeenCalledWith("outputAnalysisEvents", true);
    expect(updateField).toHaveBeenCalledWith("outputCalendar", false);
    expect(updateField).toHaveBeenCalledWith("capForceWebSearch", true);
    expect(updateField).toHaveBeenCalledWith("channelIds", []);
  });
});
