import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskDraftPayload } from "../../types";
import {
  clearTaskEditorDraftBridge,
  getTaskEditorDraftBridge,
  isTaskEditorPath,
  registerTaskEditorDraftBridge,
} from "./taskEditorDraftBridge";

describe("taskEditorDraftBridge", () => {
  afterEach(() => {
    clearTaskEditorDraftBridge();
  });

  it("registers, returns, and disposes the active bridge", () => {
    const getCurrentTask = vi.fn(
      (): TaskDraftPayload => ({ name: "draft", promptTemplate: "p" }),
    );
    const applyTaskConfig = vi.fn();
    const dispose = registerTaskEditorDraftBridge({ getCurrentTask, applyTaskConfig });

    const bridge = getTaskEditorDraftBridge();
    expect(bridge).not.toBeNull();
    expect(bridge?.getCurrentTask()).toEqual({ name: "draft", promptTemplate: "p" });
    bridge?.applyTaskConfig({ name: "updated" });
    expect(applyTaskConfig).toHaveBeenCalledWith({ name: "updated" });

    dispose();
    expect(getTaskEditorDraftBridge()).toBeNull();
  });

  it("dispose of a superseded bridge does not clear the newer registration", () => {
    const first = registerTaskEditorDraftBridge({
      getCurrentTask: () => ({ name: "first" }),
      applyTaskConfig: vi.fn(),
    });
    registerTaskEditorDraftBridge({
      getCurrentTask: () => ({ name: "second" }),
      applyTaskConfig: vi.fn(),
    });

    first();
    expect(getTaskEditorDraftBridge()?.getCurrentTask()).toEqual({ name: "second" });
  });
});

describe("isTaskEditorPath", () => {
  it("matches create and edit routes only", () => {
    expect(isTaskEditorPath("/tasks/new")).toBe(true);
    expect(isTaskEditorPath("/tasks/abc/edit")).toBe(true);
    expect(isTaskEditorPath("/tasks/abc/edit/")).toBe(true);
    // Same route pattern as `/tasks/:taskId/edit` (taskId may be "new").
    expect(isTaskEditorPath("/tasks/new/edit")).toBe(true);
    expect(isTaskEditorPath("/tasks")).toBe(false);
    expect(isTaskEditorPath("/tasks/abc")).toBe(false);
    expect(isTaskEditorPath("/dashboard")).toBe(false);
  });
});
