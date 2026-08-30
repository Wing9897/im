import { describe, expect, it } from "vitest";
import {
  AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
  autoSyncPatchFromPreset,
  autoSyncPresetFromRow,
} from "./autoSyncPresets";

describe("autoSyncPresets", () => {
  it("maps row state to preset values", () => {
    expect(autoSyncPresetFromRow(false, 300)).toBe("off");
    expect(autoSyncPresetFromRow(true, 300)).toBe(300);
    expect(autoSyncPresetFromRow(true, 120)).toBe(60);
  });

  it("builds patch bodies from presets", () => {
    expect(autoSyncPatchFromPreset("off")).toEqual({ autoSync: false });
    expect(autoSyncPatchFromPreset(900)).toEqual({ autoSync: true, autoSyncIntervalSeconds: 900 });
  });

  it("keeps floor aligned with server default and uses the server column when given", () => {
    expect(AUTO_SYNC_INTERVAL_FLOOR_SECONDS).toBe(60);
    expect(autoSyncPresetFromRow(true, 120, 60)).toBe(60);
  });
});
