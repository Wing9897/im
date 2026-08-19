import { describe, expect, it } from "vitest";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  normalizeNotifyPref,
  notifyPrefChecked,
  notifyPrefFromChecked,
} from "./notifyPref";
import { resolveEventNotify, resolveNotify } from "./resolveNotify";

describe("normalizeNotifyPref", () => {
  it("defaults blank and unknown values to inherit", () => {
    expect(normalizeNotifyPref(null)).toBe("inherit");
    expect(normalizeNotifyPref(undefined)).toBe("inherit");
    expect(normalizeNotifyPref("")).toBe("inherit");
    expect(normalizeNotifyPref("maybe")).toBe("inherit");
    expect(normalizeNotifyPref("inherit")).toBe("inherit");
    expect(normalizeNotifyPref("off")).toBe("off");
    expect(normalizeNotifyPref("follow")).toBe("inherit"); // HTTP "follow" is 422; read coerce → default
    expect(normalizeNotifyPref("on")).toBe("inherit"); // HTTP "on" is 422; read coerce → default
  });

  it("maps checkbox state to inherit / off", () => {
    expect(notifyPrefChecked("inherit")).toBe(true);
    expect(notifyPrefChecked("off")).toBe(false);
    expect(notifyPrefFromChecked(true)).toBe("inherit");
    expect(notifyPrefFromChecked(false)).toBe("off");
  });
});

describe("resolveNotify", () => {
  it("mutes everything when the global master is off", () => {
    expect(
      resolveNotify({ override: "inherit", worksetNotifyEnabled: true, globalEnabled: false }),
    ).toBe(false);
    expect(
      resolveNotify({ override: "off", worksetNotifyEnabled: true, globalEnabled: false }),
    ).toBe(false);
  });

  it("mutes everything during quiet hours / DND", () => {
    expect(
      resolveNotify({
        override: "inherit",
        worksetNotifyEnabled: true,
        globalEnabled: true,
        quietHoursActive: true,
      }),
    ).toBe(false);
  });

  it("follows the workset default", () => {
    expect(
      resolveNotify({ override: "inherit", worksetNotifyEnabled: true, globalEnabled: true }),
    ).toBe(true);
    expect(
      resolveNotify({ override: "inherit", worksetNotifyEnabled: false, globalEnabled: true }),
    ).toBe(false);
    expect(
      resolveNotify({ override: undefined, worksetNotifyEnabled: null, globalEnabled: true }),
    ).toBe(true);
  });

  it("entity off always mutes; unknown on coerces to follow then workset", () => {
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
      ["task-1", { notifyPref: "inherit" as const, worksetId: "ws-muted" }],
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
        { kind: "recurring", taskId: "ser-1", notifyPref: "inherit" },
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
        { kind: "recurring", taskId: "ser-missing", notifyPref: "inherit", worksetId: "ws-muted" },
        { globalEnabled: true, worksetNotifyById, seriesById: new Map() },
      ),
    ).toBe(false);
  });

  it("uses the user-event row pref and workset", () => {
    expect(
      resolveEventNotify(
        { kind: "user", worksetId: "ws-muted", notifyPref: "inherit" },
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
        { kind: "user", worksetId: SYSTEM_WORKSET_ID, notifyPref: "inherit" },
        { globalEnabled: true, worksetNotifyById },
      ),
    ).toBe(true);
  });
});
