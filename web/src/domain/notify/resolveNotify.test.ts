import { describe, expect, it } from "vitest";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  normalizeNotifyPref,
  notifyPrefChecked,
  notifyPrefFromChecked,
} from "./notifyPref";
import { resolveEventNotify, resolveNotify } from "./resolveNotify";

describe("normalizeNotifyPref", () => {
  it("defaults blank and unknown values to follow", () => {
    expect(normalizeNotifyPref(null)).toBe("follow");
    expect(normalizeNotifyPref(undefined)).toBe("follow");
    expect(normalizeNotifyPref("")).toBe("follow");
    expect(normalizeNotifyPref("maybe")).toBe("follow");
    expect(normalizeNotifyPref("follow")).toBe("follow");
    expect(normalizeNotifyPref("off")).toBe("off");
    expect(normalizeNotifyPref("on")).toBe("follow");
  });

  it("maps checkbox state to follow / off", () => {
    expect(notifyPrefChecked("follow")).toBe(true);
    expect(notifyPrefChecked("off")).toBe(false);
    expect(notifyPrefFromChecked(true)).toBe("follow");
    expect(notifyPrefFromChecked(false)).toBe("off");
  });
});

describe("resolveNotify", () => {
  it("mutes everything when the global master is off", () => {
    expect(
      resolveNotify({ override: "follow", worksetNotifyEnabled: true, globalEnabled: false }),
    ).toBe(false);
    expect(
      resolveNotify({ override: "off", worksetNotifyEnabled: true, globalEnabled: false }),
    ).toBe(false);
  });

  it("mutes everything during quiet hours / DND", () => {
    expect(
      resolveNotify({
        override: "follow",
        worksetNotifyEnabled: true,
        globalEnabled: true,
        quietHoursActive: true,
      }),
    ).toBe(false);
  });

  it("follows the workset default", () => {
    expect(
      resolveNotify({ override: "follow", worksetNotifyEnabled: true, globalEnabled: true }),
    ).toBe(true);
    expect(
      resolveNotify({ override: "follow", worksetNotifyEnabled: false, globalEnabled: true }),
    ).toBe(false);
    expect(
      resolveNotify({ override: undefined, worksetNotifyEnabled: null, globalEnabled: true }),
    ).toBe(true);
  });

  it("entity off always mutes; legacy on follows the workset", () => {
    expect(
      resolveNotify({ override: "on", worksetNotifyEnabled: false, globalEnabled: true }),
    ).toBe(false);
    expect(
      resolveNotify({ override: "on", worksetNotifyEnabled: true, globalEnabled: true }),
    ).toBe(true);
    expect(
      resolveNotify({ override: "off", worksetNotifyEnabled: true, globalEnabled: true }),
    ).toBe(false);
  });
});

describe("resolveEventNotify", () => {
  const worksetNotifyById = new Map<string, boolean>([
    [SYSTEM_WORKSET_ID, true],
    ["ws-muted", false],
  ]);

  it("uses analysis-task pref and workset from the catalog", () => {
    const tasksById = new Map([
      ["task-1", { notifyPref: "follow" as const, worksetId: "ws-muted" }],
      ["task-2", { notifyPref: "off" as const, worksetId: SYSTEM_WORKSET_ID }],
    ]);
    expect(
      resolveEventNotify(
        { kind: "event", taskId: "task-1" },
        { globalEnabled: true, worksetNotifyById, tasksById },
      ),
    ).toBe(false);
    expect(
      resolveEventNotify(
        { kind: "event", taskId: "task-2" },
        { globalEnabled: true, worksetNotifyById, tasksById },
      ),
    ).toBe(false);
  });

  it("uses recurring series pref for the whole series", () => {
    const seriesById = new Map([
      ["ser-1", { notifyPref: "off" as const, worksetId: SYSTEM_WORKSET_ID }],
    ]);
    expect(
      resolveEventNotify(
        { kind: "recurring", taskId: "ser-1", notifyPref: "follow" },
        { globalEnabled: true, worksetNotifyById, seriesById },
      ),
    ).toBe(false);
  });

  it("falls back to the occurrence notifyPref when the series map misses", () => {
    expect(
      resolveEventNotify(
        { kind: "recurring", taskId: "ser-missing", notifyPref: "off", worksetId: SYSTEM_WORKSET_ID },
        { globalEnabled: true, worksetNotifyById, seriesById: new Map() },
      ),
    ).toBe(false);
    expect(
      resolveEventNotify(
        { kind: "recurring", taskId: "ser-missing", notifyPref: "follow", worksetId: "ws-muted" },
        { globalEnabled: true, worksetNotifyById, seriesById: new Map() },
      ),
    ).toBe(false);
  });

  it("uses the user-event row pref and workset", () => {
    expect(
      resolveEventNotify(
        { kind: "user", worksetId: "ws-muted", notifyPref: "follow" },
        { globalEnabled: true, worksetNotifyById },
      ),
    ).toBe(false);
    expect(
      resolveEventNotify(
        { kind: "user", worksetId: SYSTEM_WORKSET_ID, notifyPref: "off" },
        { globalEnabled: true, worksetNotifyById },
      ),
    ).toBe(false);
    expect(
      resolveEventNotify(
        { kind: "user", worksetId: SYSTEM_WORKSET_ID, notifyPref: "follow" },
        { globalEnabled: true, worksetNotifyById },
      ),
    ).toBe(true);
  });
});
