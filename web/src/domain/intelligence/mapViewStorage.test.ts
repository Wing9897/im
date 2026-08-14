import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAP_TIME_WINDOW_STORAGE_KEY, SHARED_DANMAKU_MODE_KEY } from "../prefs";
import {
  parsePersistedMapTimeWindow,
  readSharedDanmakuMode,
  readStoredMapTimeWindow,
  serializeMapTimeWindow,
  writeStoredMapTimeWindow,
} from "./mapViewStorage";

describe("readSharedDanmakuMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("returns the shared key when it is already valid", () => {
    localStorage.setItem(SHARED_DANMAKU_MODE_KEY, "transient");

    expect(readSharedDanmakuMode()).toBe("transient");
    expect(localStorage.getItem(SHARED_DANMAKU_MODE_KEY)).toBe("transient");
  });

  it("defaults to persistent when no valid value exists", () => {
    expect(readSharedDanmakuMode()).toBe("persistent");
    expect(localStorage.getItem(SHARED_DANMAKU_MODE_KEY)).toBeNull();
  });

  it("defaults to persistent when shared key has invalid value", () => {
    localStorage.setItem(SHARED_DANMAKU_MODE_KEY, "invalid");

    expect(readSharedDanmakuMode()).toBe("persistent");
  });
});

describe("map time window persistence", () => {
  const fallback = {
    start: new Date("2026-01-01T00:00:00.000Z"),
    end: new Date("2026-01-02T00:00:00.000Z"),
  };

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips committed window through localStorage", () => {
    const window = {
      start: new Date("2026-04-10T08:00:00.000Z"),
      end: new Date("2026-04-12T20:00:00.000Z"),
    };
    writeStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, window);
    const restored = readStoredMapTimeWindow(MAP_TIME_WINDOW_STORAGE_KEY, fallback);
    expect(restored.start.toISOString()).toBe(window.start.toISOString());
    expect(restored.end.toISOString()).toBe(window.end.toISOString());
  });

  it("parsePersistedMapTimeWindow rejects invalid payloads", () => {
    expect(parsePersistedMapTimeWindow(null, fallback)).toEqual(fallback);
    expect(parsePersistedMapTimeWindow({ start: "x", end: "y" }, fallback)).toEqual(fallback);
    expect(
      parsePersistedMapTimeWindow(
        serializeMapTimeWindow({
          start: new Date("2026-04-10T08:00:00.000Z"),
          end: new Date("2026-04-09T08:00:00.000Z"),
        }),
        fallback,
      ),
    ).toEqual(fallback);
  });
});
