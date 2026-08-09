/**
 * Focused tests for task-advisor tool attribution in live/history tool steps.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AssistantLiveToolSteps, AssistantToolSummary } from "./AssistantToolSteps";
import { wrapWithI18n } from "../../test/i18nHarness";

describe("AssistantToolSteps task advisor attribution", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("attributes consult_advisor live steps to taskEditor when enabled", () => {
    act(() => {
      root.render(
        wrapWithI18n(createElement(AssistantLiveToolSteps, {
            attributeTaskAdvisor: true,
            steps: [
              {
                name: "tasks.consult_advisor",
                arguments: { instruction: "改名" },
                resultSummary: "",
                status: "running",
              },
            ],
          })),
      );
    });

    const staff = host.querySelector("[data-testid='assistant-tool-step-staff']");
    expect(staff?.getAttribute("data-staff-id")).toBe("taskEditor");
    expect(host.querySelector("[data-testid='ai-staff-avatar-taskEditor']")).not.toBeNull();
  });

  it("does not attribute consult_advisor when disabled", () => {
    act(() => {
      root.render(
        wrapWithI18n(createElement(AssistantToolSummary, {
            toolCalls: [
              {
                name: "tasks.consult_advisor",
                arguments: { instruction: "改名" },
                resultSummary: "ok",
              },
            ],
          })),
      );
    });

    expect(host.querySelector("[data-testid='assistant-tool-step-staff']")).toBeNull();
    expect(host.textContent).toContain("tasks.consult_advisor");
  });
});
