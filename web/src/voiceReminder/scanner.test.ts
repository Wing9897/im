import { beforeEach, describe, expect, it, vi } from "vitest";
import { getGeneralWorksetLabel } from "../domain/timeline/userEvents";
import { SYSTEM_WORKSET_ID } from "../types/worksets";
import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";
import {
  buildDedupeKey,
  buildSpeakText,
  collectDueReminders,
  computeFetchRange,
  filterEventsBySourceFilter,
  formatLeadSpeakPhrase,
  getMaxLeadMinutes,
  hydrateFiredKeys,
  isWithinQuietHours,
  isRemindAtDue,
  loadFiredKeys,
  mergeTimedKeyEventsById,
  parseStartTimeFromDedupeKey,
  pruneFiredKeys,
  resetFiredKeysCacheForTests,
  saveFiredKeys,
  claimFiredKeys,
  toTimedKeyEvents,
  userEventsToTimedKeyEvents,
  type TimedKeyEvent,
} from "./scanner";

const { mockFetchFired, mockPutFired, mockClaimFired } = vi.hoisted(() => ({
  mockFetchFired: vi.fn(),
  mockPutFired: vi.fn(),
  mockClaimFired: vi.fn(),
}));

vi.mock("../api/uiPrefs", () => ({
  fetchVoiceReminderFired: (...args: unknown[]) => mockFetchFired(...args),
  putVoiceReminderFired: (...args: unknown[]) => mockPutFired(...args),
  claimVoiceReminderFired: (...args: unknown[]) => mockClaimFired(...args),
}));

function makeEvent(overrides: Partial<TimedKeyEvent> = {}): TimedKeyEvent {
  return {
    id: "evt-1",
    taskId: "task-1",
    taskName: "情資任務",
    title: "會議",
    startTime: "2026-07-19T10:00:00.000Z",
    ...overrides,
  };
}

describe("voiceReminder scanner", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    resetFiredKeysCacheForTests();
    mockFetchFired.mockReset();
    mockPutFired.mockReset();
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  describe("lead calc / speak text", () => {
    it("gates reminders during normal and overnight quiet hours", () => {
      expect(
        isWithinQuietHours(new Date(2026, 6, 20, 23, 0), { start: "22:00", end: "07:00" }),
      ).toBe(true);
      expect(
        isWithinQuietHours(new Date(2026, 6, 20, 6, 59), { start: "22:00", end: "07:00" }),
      ).toBe(true);
      expect(
        isWithinQuietHours(new Date(2026, 6, 20, 7, 0), { start: "22:00", end: "07:00" }),
      ).toBe(false);
      expect(
        isWithinQuietHours(new Date(2026, 6, 20, 13, 0), { start: "12:00", end: "14:00" }),
      ).toBe(true);
    });

    it("formats lead phrases and speak text", () => {
      expect(formatLeadSpeakPhrase(15)).toBe("約十五分鐘");
      expect(formatLeadSpeakPhrase(60)).toBe("約一小時");
      expect(formatLeadSpeakPhrase(240)).toBe("約四小時");
      expect(formatLeadSpeakPhrase(1440)).toBe("約一天");
      expect(buildSpeakText("情資任務", "會議", 60)).toBe(
        "任務「情資任務」，關鍵事件「會議」，還有約一小時",
      );
      expect(buildSpeakText("", "會議", 60)).toBe(
        "關鍵事件「會議」，還有約一小時",
      );
      expect(buildSpeakText(getGeneralWorksetLabel(), "用戶提醒", 15, "user")).toBe(
        `工作集「${getGeneralWorksetLabel()}」，提醒「用戶提醒」，還有約十五分鐘`,
      );
      expect(buildSpeakText("週會", "站立會議", 15, "recurring")).toBe(
        "任務「週會」，循環任務「站立會議」，還有約十五分鐘",
      );
    });

    it("maps user-event rows with the shared filter label as taskName", () => {
      const timed = toTimedKeyEvents([
        {
          id: "ue-1",
          taskId: null,
          taskName: getGeneralWorksetLabel(),
          title: "用戶提醒",
          startTime: "2026-07-20T10:00:00.000Z",
        },
      ]);
      expect(timed).toHaveLength(1);
      expect(timed[0]?.taskName).toBe(getGeneralWorksetLabel());
    });

    it("computes remindAt as start minus lead for due window", () => {
      const startMs = Date.parse("2026-07-19T10:00:00.000Z");
      const leadMinutes = 60;
      const remindAtMs = startMs - leadMinutes * 60_000;
      expect(isRemindAtDue(remindAtMs, remindAtMs)).toBe(true);
      expect(isRemindAtDue(remindAtMs, remindAtMs - 1)).toBe(false);
      expect(isRemindAtDue(remindAtMs, remindAtMs + 90_000)).toBe(true);
      expect(isRemindAtDue(remindAtMs, remindAtMs + 5 * 60_000)).toBe(false);
    });

    it("computes fetch range with look-back and maxLead + buffer", () => {
      const nowMs = Date.parse("2026-07-19T08:00:00.000Z");
      const { rangeStart, rangeEnd } = computeFetchRange(
        nowMs,
        60,
        5 * 60_000,
        60_000,
      );
      expect(rangeStart).toBe("2026-07-19T07:59:00.000Z");
      expect(rangeEnd).toBe("2026-07-19T09:05:00.000Z");
      expect(getMaxLeadMinutes([15, 60, 240])).toBe(240);
      expect(getMaxLeadMinutes([])).toBe(0);
    });
  });

  describe("filter by source selection", () => {
    it("null selection keeps all; explicit taskIds filters", () => {
      const items = [
        makeEvent({ id: "a", taskId: "t1" }),
        makeEvent({ id: "b", taskId: "t2" }),
      ];
      expect(filterEventsBySourceFilter(items, null)).toHaveLength(2);
      expect(
        filterEventsBySourceFilter(items, { taskIds: ["t2"], worksetIds: [] }).map(
          (o) => o.id,
        ),
      ).toEqual(["b"]);
    });

    it("expands selected worksets to member task ids via the catalog", () => {
      const items = [
        makeEvent({ id: "a", taskId: "t1" }),
        makeEvent({ id: "b", taskId: "t2" }),
      ];
      const catalogTasks = [{ id: "t1", worksetId: "ws-1" }, { id: "t2", worksetId: null }];
      expect(
        filterEventsBySourceFilter(
          items,
          { taskIds: [], worksetIds: ["ws-1"] },
          catalogTasks,
        ).map((o) => o.id),
      ).toEqual(["a"]);
    });

    it("matches event.worksetId directly without requiring a taskId", () => {
      const items = [
        makeEvent({ id: "owned", taskId: null, worksetId: "ws-1" }),
        makeEvent({ id: "other", taskId: "t2", worksetId: "ws-2" }),
      ];
      expect(
        filterEventsBySourceFilter(items, { taskIds: [], worksetIds: ["ws-1"] }).map(
          (o) => o.id,
        ),
      ).toEqual(["owned"]);
    });

    it("empty selection (no tasks, no worksets) excludes everything", () => {
      const items = [makeEvent({ id: "a", taskId: "t1" })];
      expect(filterEventsBySourceFilter(items, { taskIds: [], worksetIds: [] })).toEqual([]);
    });

    it("workset-only selection does not match user events via expanded provenance", () => {
      const catalogTasks = [{ id: "member-a", worksetId: "ws-a" }];
      const items = [
        makeEvent({
          id: "ue-leak",
          kind: "user",
          taskId: "member-a",
          worksetId: "ws-b",
        }),
        makeEvent({
          id: "analysis-ok",
          kind: "event",
          taskId: "member-a",
          worksetId: null,
        }),
      ];
      expect(
        filterEventsBySourceFilter(
          items,
          { taskIds: [], worksetIds: ["ws-a"] },
          catalogTasks,
        ).map((e) => e.id),
      ).toEqual(["analysis-ok"]);
    });
  });

  describe("toTimedKeyEvents", () => {
    it("drops rows without startTime", () => {
      expect(
        toTimedKeyEvents([
          { id: "1", title: "a", startTime: "2026-07-19T10:00:00.000Z" },
          { id: "2", title: "b", startTime: null },
        ]),
      ).toHaveLength(1);
    });
  });

  describe("userEventsToTimedKeyEvents", () => {
    it("keeps taskId as provenance and ownership on worksetId", () => {
      const timed = userEventsToTimedKeyEvents(
        [
          {
            id: "ue-unassigned",
            title: "Unassigned",
            startTime: "2026-07-20T10:00:00.000Z",
            taskId: "",
            worksetId: SYSTEM_WORKSET_ID,
          },
          {
            id: "ue-tagged",
            title: "Tagged",
            startTime: "2026-07-20T11:00:00.000Z",
            taskId: "ct-1",
            worksetId: "ws-1",
          },
        ],
        new Map([["ct-1", "日曆任務"]]),
      );
      expect(timed).toEqual([
        expect.objectContaining({
          id: "ue-unassigned",
          taskId: null,
          worksetId: SYSTEM_WORKSET_ID,
          taskName: getGeneralWorksetLabel(),
          kind: "user",
        }),
        expect.objectContaining({
          id: "ue-tagged",
          taskId: "ct-1",
          worksetId: "ws-1",
          taskName: "日曆任務",
          kind: "user",
        }),
      ]);
      expect(
        filterEventsBySourceFilter(timed, {
          taskIds: [],
          worksetIds: [SYSTEM_WORKSET_ID],
        }).map((e) => e.id),
      ).toEqual(["ue-unassigned"]);
      expect(
        filterEventsBySourceFilter(timed, { taskIds: [], worksetIds: ["ws-1"] }).map(
          (e) => e.id,
        ),
      ).toEqual(["ue-tagged"]);
      expect(
        filterEventsBySourceFilter(timed, { taskIds: ["ct-1"], worksetIds: [] }).map(
          (e) => e.id,
        ),
      ).toEqual(["ue-tagged"]);
    });
  });

  describe("mergeTimedKeyEventsById", () => {
    it("keeps first occurrence of duplicate ids", () => {
      const merged = mergeTimedKeyEventsById(
        [makeEvent({ id: "same", title: "first" })],
        [makeEvent({ id: "same", title: "second" }), makeEvent({ id: "other" })],
      );
      expect(merged.map((event) => event.id)).toEqual(["same", "other"]);
      expect(merged[0]?.title).toBe("first");
    });
  });

  describe("collectDueReminders", () => {
    it("collects due leads and skips fired keys", () => {
      const startTime = "2026-07-19T10:00:00.000Z";
      const startMs = Date.parse(startTime);
      const nowMs = startMs - 60 * 60_000;
      const fired = new Set([buildDedupeKey("evt-1", 15, startTime)]);
      const due = collectDueReminders({
        events: [makeEvent({ startTime })],
        leadOffsetsMinutes: [15, 60],
        nowMs,
        firedKeys: fired,
      });
      expect(due.map((d) => d.leadOffsetMinutes)).toEqual([60]);
      expect(due[0]?.speakText).toContain("約一小時");
    });

    it("handles all-day-like ISO start the same way", () => {
      const startTime = "2026-07-20T00:00:00.000Z";
      const startMs = Date.parse(startTime);
      const nowMs = startMs - 1440 * 60_000;
      const due = collectDueReminders({
        events: [makeEvent({ id: "day", startTime, title: "全日" })],
        leadOffsetsMinutes: [1440],
        nowMs,
        firedKeys: new Set(),
      });
      expect(due).toHaveLength(1);
      expect(due[0]?.dedupeKey).toBe(buildDedupeKey("day", 1440, startTime));
    });
  });

  describe("fired key prune", () => {
    it("parses startTime and prunes old keys", () => {
      const startTime = "2026-07-01T00:00:00.000Z";
      const key = buildDedupeKey("x", 60, startTime);
      expect(key).toBe(`x::60::${startTime}`);
      expect(parseStartTimeFromDedupeKey(key)).toBe(startTime);
      const nowMs = Date.parse("2026-07-10T00:00:00.000Z");
      const pruned = pruneFiredKeys(new Set([key]), nowMs, 2 * 24 * 60 * 60_000);
      expect(pruned.size).toBe(0);
    });

    it("rejects non-canonical pipe-separated keys", () => {
      const startTime = "2026-07-20T10:00:00.000Z";
      const key = `evt|60|${startTime}`;
      expect(parseStartTimeFromDedupeKey(key)).toBeNull();
      expect(pruneFiredKeys(new Set([key]), Date.parse(startTime), 0)).toEqual(new Set());
    });
  });

  describe("fired key hydrate / save", () => {
    it("uses empty set when server is empty", async () => {
      mockFetchFired.mockResolvedValue({ configured: false, keys: null });

      const keys = await hydrateFiredKeys();
      expect(mockPutFired).not.toHaveBeenCalled();
      expect(keys.size).toBe(0);
    });

    it("saves via API and updates the cache", async () => {
      const key = buildDedupeKey("e1", 60, "2026-07-24T10:00:00.000Z");
      mockPutFired.mockResolvedValue({ configured: true, keys: [key] });
      await expect(saveFiredKeys(new Set([key]))).resolves.toBe(true);
      expect(mockPutFired).toHaveBeenCalledWith([key]);
      expect(loadFiredKeys().has(key)).toBe(true);
    });

    it("claims keys and updates cache from server response", async () => {
      const key = buildDedupeKey("e1", 60, "2026-07-24T10:00:00.000Z");
      mockClaimFired.mockResolvedValue({
        configured: true,
        claimed: [key],
        keys: [key],
      });
      const won = await claimFiredKeys([key]);
      expect(mockClaimFired).toHaveBeenCalledWith([key]);
      expect(won.has(key)).toBe(true);
      expect(loadFiredKeys().has(key)).toBe(true);
    });
  });
});
