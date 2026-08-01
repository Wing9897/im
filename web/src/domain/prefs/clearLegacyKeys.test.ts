import { beforeEach, describe, expect, it } from "vitest";

import { clearLegacyPrefsIfNeeded } from "./clearLegacyKeys";
import { PREFS_SCHEMA_VERSION, PREFS_SCHEMA_VERSION_KEY } from "./keys";

describe("clearLegacyPrefsIfNeeded", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("clears im:* keys once and writes the schema marker", () => {
    localStorage.setItem("im:theme", "dark");
    localStorage.setItem("im:timeline:view-mode", JSON.stringify("gantt"));
    sessionStorage.setItem("im:tasks:chat-editor:form:new", "{}");
    localStorage.setItem("unrelated", "keep");

    clearLegacyPrefsIfNeeded();

    expect(localStorage.getItem("im:theme")).toBeNull();
    expect(localStorage.getItem("im:timeline:view-mode")).toBeNull();
    expect(sessionStorage.getItem("im:tasks:chat-editor:form:new")).toBeNull();
    expect(localStorage.getItem("unrelated")).toBe("keep");
    expect(localStorage.getItem(PREFS_SCHEMA_VERSION_KEY)).toBe(PREFS_SCHEMA_VERSION);

    localStorage.setItem("im:theme", "after");
    clearLegacyPrefsIfNeeded();
    expect(localStorage.getItem("im:theme")).toBe("after");
  });

  it("is a no-op when the current schema marker is already present", () => {
    localStorage.setItem(PREFS_SCHEMA_VERSION_KEY, PREFS_SCHEMA_VERSION);
    localStorage.setItem("im:theme", "keep");

    clearLegacyPrefsIfNeeded();

    expect(localStorage.getItem("im:theme")).toBe("keep");
  });
});
