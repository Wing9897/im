import { describe, it, expect } from "vitest";
import type { SystemSettingsSnapshot } from "../../types";
import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";

function makeSnapshot(overrides: Partial<SystemSettingsSnapshot> = {}): SystemSettingsSnapshot {
  return { ...defaultSettingsSnapshot, ...overrides };
}

function hasUnsavedChanges(
  current: SystemSettingsSnapshot | null,
  saved: SystemSettingsSnapshot | null,
): boolean {
  if (!current || !saved) return false;
  return JSON.stringify(current) !== JSON.stringify(saved);
}

function deepEqual(a: SystemSettingsSnapshot, b: SystemSettingsSnapshot): boolean {
  const keys = Object.keys(a) as (keyof SystemSettingsSnapshot)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((key) => a[key] === b[key]);
}

describe("hasUnsavedChanges", () => {
  it("returns true iff current and saved are not deeply equal", () => {
    const base = makeSnapshot();
    const modified = makeSnapshot({ analysisTriggerThreshold: "5" });
    const differentTimeout = makeSnapshot({ llmGenerationTimeout: "90" });

    expect(hasUnsavedChanges(base, modified)).toBe(true);
    expect(hasUnsavedChanges(base, differentTimeout)).toBe(true);
    expect(hasUnsavedChanges(base, base)).toBe(!deepEqual(base, base));
    expect(hasUnsavedChanges(modified, base)).toBe(true);
  });

  it("returns false when current and saved are identical copies", () => {
    const snapshot = makeSnapshot({ analysisPaused: true, analysisTriggerThreshold: "7" });
    const copy = { ...snapshot };
    expect(hasUnsavedChanges(snapshot, copy)).toBe(false);
  });

  it("returns false when either argument is null", () => {
    const snapshot = makeSnapshot();
    expect(hasUnsavedChanges(null, snapshot)).toBe(false);
    expect(hasUnsavedChanges(snapshot, null)).toBe(false);
    expect(hasUnsavedChanges(null, null)).toBe(false);
  });
});
