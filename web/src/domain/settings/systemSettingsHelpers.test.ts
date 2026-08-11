import { describe, expect, it } from "vitest";

import { defaultSettingsSnapshot } from "../../test/settingsSnapshot";
import {
  buildSettingsObject,
  mergePersistedSnapshot,
  shouldShowConcurrentBatchesWarning,
  toPersistableSettings,
} from "./systemSettingsHelpers";

describe("buildSettingsObject analysis scheduling mapping", () => {
  it("analysis trigger threshold and batch limit round-trip independently", () => {
    const snapshot = {
      ...defaultSettingsSnapshot,
      analysisTriggerThreshold: "1",
      analysisBatchMessageLimit: "50",
    };
    const settingsObject = buildSettingsObject(snapshot);
    expect(settingsObject.analysisTriggerThreshold).toBe("1");
    expect(settingsObject.analysisBatchMessageLimit).toBe("50");
  });
});

describe("shouldShowConcurrentBatchesWarning", () => {
  it("returns false when value unchanged or decreasing", () => {
    expect(shouldShowConcurrentBatchesWarning("1", "1")).toBe(false);
    expect(shouldShowConcurrentBatchesWarning("1", "2")).toBe(false);
    expect(shouldShowConcurrentBatchesWarning("2", "3")).toBe(false);
  });

  it("returns true only when increasing above 1", () => {
    expect(shouldShowConcurrentBatchesWarning("3", "1")).toBe(true);
    expect(shouldShowConcurrentBatchesWarning("2", "1")).toBe(true);
    expect(shouldShowConcurrentBatchesWarning("2", "2")).toBe(false);
  });
});

describe("mergePersistedSnapshot", () => {
  it("keeps settings and savedSnapshot aligned after retention partial save", () => {
    const saved = { ...defaultSettingsSnapshot };
    const draft = {
      ...saved,
      retentionMessagesDays: "30",
      retentionAnalysisDays: "30",
      retentionLeaderboardDays: "30",
    };

    expect(JSON.stringify(draft) !== JSON.stringify(saved)).toBe(true);

    const serverResponse = {
      ...defaultSettingsSnapshot,
      retentionMessagesDays: "30",
      retentionAnalysisDays: "30",
      retentionLeaderboardDays: "30",
    };
    const settingsAfter = mergePersistedSnapshot(draft, serverResponse);
    const savedAfter = mergePersistedSnapshot(saved, serverResponse);

    expect(JSON.stringify(settingsAfter)).toBe(JSON.stringify(savedAfter));
    expect(settingsAfter.retentionMessagesDays).toBe("30");
  });
});

describe("toPersistableSettings", () => {
  it("omits analysisPaused so stale snapshot cannot resume scheduler on save", () => {
    const stale = { ...defaultSettingsSnapshot, analysisPaused: false };
    const payload = toPersistableSettings(stale);

    expect(payload).not.toHaveProperty("analysisPaused");
    expect(payload.llmGenerationTimeout).toBe("120");
  });

  it("preserves other fields when analysisPaused is true in memory", () => {
    const paused = { ...defaultSettingsSnapshot, analysisPaused: true };
    const payload = toPersistableSettings(paused);

    expect(payload).not.toHaveProperty("analysisPaused");
    expect(payload.retentionMessagesDays).toBe("90");
  });

  it("perserves trigger threshold and batch limit independently on persist", () => {
    const snapshot = {
      ...defaultSettingsSnapshot,
      analysisBatchMessageLimit: "50",
      analysisTriggerThreshold: "1",
    };
    const payload = toPersistableSettings(snapshot);
    expect(payload.analysisBatchMessageLimit).toBe("50");
    expect(payload.analysisTriggerThreshold).toBe("1");
  });

  it("normalizes legacy analysisStrategyMode on persist", () => {
    const snapshot = { ...defaultSettingsSnapshot, analysisStrategyMode: "incremental" };
    const payload = toPersistableSettings(snapshot);
    expect(payload.analysisStrategyMode).toBe("balanced");
  });
});
