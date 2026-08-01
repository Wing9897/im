import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RESOURCE_MODIFIED_EVENT,
  emitResourceModified,
  subscribeResourceModified,
} from "./resourceModified";

describe("resourceModified bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies subscribers with the SSE payload shape", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeResourceModified(handler);
    emitResourceModified({
      resourceType: "task",
      resourceId: "task-1",
      action: "created",
    });
    expect(handler).toHaveBeenCalledWith({
      resourceType: "task",
      resourceId: "task-1",
      action: "created",
    });
    unsubscribe();
    emitResourceModified({
      resourceType: "user_event",
      resourceId: "ue-1",
      action: "created",
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("uses the shared window event name", () => {
    expect(RESOURCE_MODIFIED_EVENT).toBe("im:resource-modified");
  });
});
