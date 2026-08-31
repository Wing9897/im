import { describe, expect, it } from "vitest";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { makeEvent } from "../../test/timelineTestHelpers";
import {
  MONTH_CARD_SOFT_CAP,
  applyCalendarScalePill,
  buildMonthCardModels,
  calendarScalePills,
  isCalendarScalePillActive,
  isMonthCardsLibrarySkip,
  isMonthCardsMode,
  monthCardsFetchSkip,
  parseTimelineMonthLayout,
  resolveMonthCardSources,
  showMonthDatesRevealChrome,
  sliceEventsForMonthCard,
} from "./monthCardSources";

const WORKSETS = [{ id: SYSTEM_WORKSET_ID }, { id: "ws-a" }, { id: "ws-b" }];
const TASKS = [
  { id: "t-a1", worksetId: "ws-a" },
  { id: "t-b1", worksetId: "ws-b" },
];

describe("monthCardSources", () => {
  it("parses month-layout prefs and treats unknown as unified", () => {
    expect(parseTimelineMonthLayout("split")).toBe("split");
    expect(parseTimelineMonthLayout("unified")).toBe("unified");
    expect(parseTimelineMonthLayout("cards")).toBe("unified");
    expect(parseTimelineMonthLayout(null)).toBe("unified");
  });

  it("skips the library when both filters are null and the catalog is empty or over the cap", () => {
    expect(isMonthCardsLibrarySkip(null, null)).toBe(true);
    expect(
      isMonthCardsLibrarySkip(null, null, {
        worksets: WORKSETS,
        subscribeCatalogKeys: ["Alice/Work"],
      }),
    ).toBe(false);
    expect(isMonthCardsLibrarySkip({ taskIds: [], worksetIds: ["ws-a"] }, null)).toBe(false);
    expect(isMonthCardsLibrarySkip(null, ["Alice/Work"])).toBe(false);
    expect(isMonthCardsLibrarySkip({ taskIds: [], worksetIds: [] }, [])).toBe(false);
  });

  it("treats month-cards mode as calendar + month + split only", () => {
    expect(isMonthCardsMode("calendar", "month", "split")).toBe(true);
    expect(isMonthCardsMode("calendar", "month", "unified")).toBe(false);
    expect(isMonthCardsMode("calendar", "week", "split")).toBe(false);
    expect(isMonthCardsMode("gantt", "month", "split")).toBe(false);
  });

  it("hides 顯示日期 watermark chrome in Block/split and keeps it for unified month", () => {
    expect(showMonthDatesRevealChrome("calendar", "month", "unified")).toBe(true);
    expect(showMonthDatesRevealChrome("calendar", "month", "split")).toBe(false);
    expect(showMonthDatesRevealChrome("calendar", "week", "unified")).toBe(false);
    expect(showMonthDatesRevealChrome("gantt", "month", "unified")).toBe(false);
  });

  it("gates split fetches per side; null expands only when merged cards stay ≤12", () => {
    expect(monthCardsFetchSkip(false, null, null)).toEqual({
      skipLocal: false,
      skipSubscribe: false,
    });
    expect(monthCardsFetchSkip(true, null, null)).toEqual({
      skipLocal: true,
      skipSubscribe: true,
    });
    expect(
      monthCardsFetchSkip(true, null, null, {
        worksets: WORKSETS,
        subscribeCatalogKeys: ["Alice/Work"],
      }),
    ).toEqual({ skipLocal: false, skipSubscribe: false });
    expect(monthCardsFetchSkip(true, null, ["Alice/Work"])).toEqual({
      skipLocal: true,
      skipSubscribe: false,
    });
    expect(
      monthCardsFetchSkip(true, { taskIds: [], worksetIds: ["ws-a"] }, null),
    ).toEqual({ skipLocal: false, skipSubscribe: true });
    const manyWorksets = Array.from({ length: 13 }, (_, i) => ({ id: `ws-${i}` }));
    expect(
      monthCardsFetchSkip(true, null, null, {
        worksets: manyWorksets,
        subscribeCatalogKeys: [],
      }),
    ).toEqual({ skipLocal: true, skipSubscribe: true });
  });

  it("keeps month-cards on the calendar scale row only", () => {
    expect(calendarScalePills("calendar")).toEqual(["day", "week", "month", "cards"]);
    expect(calendarScalePills("gantt")).toEqual([
      "day",
      "week",
      "month",
      "quarter",
      "year",
      "overview",
    ]);
    expect(
      isCalendarScalePillActive("cards", {
        viewMode: "calendar",
        timeScale: "month",
        monthLayout: "split",
      }),
    ).toBe(true);
    expect(
      isCalendarScalePillActive("month", {
        viewMode: "calendar",
        timeScale: "month",
        monthLayout: "split",
      }),
    ).toBe(false);
    expect(
      isCalendarScalePillActive("month", {
        viewMode: "gantt",
        timeScale: "month",
        monthLayout: "split",
      }),
    ).toBe(true);
    expect(applyCalendarScalePill("cards", "calendar")).toEqual({
      timeScale: "month",
      monthLayout: "split",
      overviewMode: false,
    });
    expect(applyCalendarScalePill("month", "calendar")).toEqual({
      timeScale: "month",
      monthLayout: "unified",
      overviewMode: false,
    });
    expect(applyCalendarScalePill("month", "gantt")).toEqual({
      timeScale: "month",
      overviewMode: false,
    });
    expect(applyCalendarScalePill("overview", "gantt")).toEqual({ overviewMode: true });
    expect(
      isCalendarScalePillActive("overview", {
        viewMode: "gantt",
        timeScale: "month",
        monthLayout: "unified",
        overviewMode: true,
      }),
    ).toBe(true);
    expect(
      isCalendarScalePillActive("year", {
        viewMode: "gantt",
        timeScale: "year",
        monthLayout: "unified",
        overviewMode: true,
      }),
    ).toBe(false);
  });

  it("expands null filters to catalog ids when merged count is at most 12", () => {
    expect(
      resolveMonthCardSources({
        selectedSources: null,
        worksets: WORKSETS,
        tasks: TASKS,
        selectedSubscribeKeys: null,
        subscribeCatalogKeys: ["Alice/Work"],
      }),
    ).toEqual({
      cards: [
        { kind: "workset", worksetId: SYSTEM_WORKSET_ID },
        { kind: "workset", worksetId: "ws-a" },
        { kind: "workset", worksetId: "ws-b" },
        { kind: "subscribe", key: "Alice/Work" },
      ],
      omitted: 0,
      emptyReason: null,
    });
  });

  it("keeps both-null empty when expanding the catalog would exceed 12", () => {
    const worksets = Array.from({ length: 10 }, (_, i) => ({ id: `ws-${i}` }));
    const subscribeKeys = Array.from({ length: 5 }, (_, i) => `h${i}/s`);
    expect(
      resolveMonthCardSources({
        selectedSources: null,
        worksets,
        selectedSubscribeKeys: null,
        subscribeCatalogKeys: subscribeKeys,
      }),
    ).toEqual({ cards: [], omitted: 0, emptyReason: "select_all" });
  });

  it("returns need_selection when both filters are null and the catalog is empty", () => {
    expect(
      resolveMonthCardSources({
        selectedSources: null,
        worksets: [],
        selectedSubscribeKeys: null,
        subscribeCatalogKeys: [],
      }),
    ).toEqual({ cards: [], omitted: 0, emptyReason: "need_selection" });
  });

  it("builds workset + subscribe cards from explicit checks (no task cards)", () => {
    const result = resolveMonthCardSources({
      selectedSources: { taskIds: ["t-a1"], worksetIds: ["ws-a", "ws-b"] },
      worksets: WORKSETS,
      tasks: TASKS,
      selectedSubscribeKeys: ["Alice/Work"],
      subscribeCatalogKeys: ["Alice/Work", "Bob/Home"],
    });
    expect(result.cards).toEqual([
      { kind: "workset", worksetId: "ws-a" },
      { kind: "workset", worksetId: "ws-b" },
      { kind: "subscribe", key: "Alice/Work" },
    ]);
    expect(result.omitted).toBe(0);
    expect(result.emptyReason).toBeNull();
  });

  it("derives a workset card from selected tasks without adding a task card", () => {
    const result = resolveMonthCardSources({
      selectedSources: { taskIds: ["t-b1"], worksetIds: [] },
      worksets: WORKSETS,
      tasks: TASKS,
      selectedSubscribeKeys: [],
      subscribeCatalogKeys: ["Alice/Work"],
    });
    expect(result.cards).toEqual([{ kind: "workset", worksetId: "ws-b" }]);
    expect(result.emptyReason).toBeNull();
  });

  it("expands a null subscribe side when merged cards stay at or under 12", () => {
    const result = resolveMonthCardSources({
      selectedSources: { taskIds: [], worksetIds: ["ws-a"] },
      worksets: WORKSETS,
      tasks: TASKS,
      selectedSubscribeKeys: null,
      subscribeCatalogKeys: ["Alice/Work", "Bob/Home"],
    });
    expect(result.cards).toEqual([
      { kind: "workset", worksetId: "ws-a" },
      { kind: "subscribe", key: "Alice/Work" },
      { kind: "subscribe", key: "Bob/Home" },
    ]);
  });

  it("does not expand a null subscribe side when it would push the merge over 12", () => {
    const worksets = Array.from({ length: 10 }, (_, i) => ({ id: `ws-${i}` }));
    const subscribeKeys = Array.from({ length: 5 }, (_, i) => `h${i}/s`);
    const result = resolveMonthCardSources({
      selectedSources: { taskIds: [], worksetIds: worksets.map((row) => row.id) },
      worksets,
      selectedSubscribeKeys: null,
      subscribeCatalogKeys: subscribeKeys,
    });
    expect(result.cards).toEqual(worksets.map((row) => ({ kind: "workset", worksetId: row.id })));
    expect(result.omitted).toBe(0);
    expect(result.emptyReason).toBeNull();
  });

  it("caps at 12 cards and reports omitted", () => {
    const worksets = Array.from({ length: 10 }, (_, i) => ({ id: `ws-${i}` }));
    const subscribeKeys = Array.from({ length: 8 }, (_, i) => `h${i}/s`);
    const result = resolveMonthCardSources({
      selectedSources: { taskIds: [], worksetIds: worksets.map((row) => row.id) },
      worksets,
      selectedSubscribeKeys: subscribeKeys,
      subscribeCatalogKeys: subscribeKeys,
    });
    expect(result.cards).toHaveLength(MONTH_CARD_SOFT_CAP);
    expect(result.omitted).toBe(6);
    expect(result.emptyReason).toBeNull();
    expect(result.cards.at(-1)).toEqual({ kind: "subscribe", key: "h1/s" });
  });

  it("does not leak events onto another card", () => {
    const events = [
      makeEvent({
        id: "local-a",
        worksetId: "ws-a",
        taskId: "t-a1",
        source: "user",
      }),
      makeEvent({
        id: "local-b",
        worksetId: "ws-b",
        taskId: "t-b1",
        source: "user",
      }),
      makeEvent({
        id: "sub-a",
        source: "subscribed:Alice/Work",
        worksetId: null,
        taskId: null,
      }),
    ];
    const wsA = sliceEventsForMonthCard(
      events,
      { kind: "workset", worksetId: "ws-a" },
      { taskIds: [], worksetIds: ["ws-a", "ws-b"] },
      TASKS,
    );
    const sub = sliceEventsForMonthCard(
      events,
      { kind: "subscribe", key: "Alice/Work" },
      { taskIds: [], worksetIds: ["ws-a", "ws-b"] },
      TASKS,
    );
    expect(wsA.map((event) => event.id)).toEqual(["local-a"]);
    expect(sub.map((event) => event.id)).toEqual(["sub-a"]);
  });

  it("filters task-only workset cards to the checked tasks", () => {
    const events = [
      makeEvent({ id: "keep", worksetId: "ws-a", taskId: "t-a1", source: "analysis" }),
      makeEvent({ id: "drop", worksetId: "ws-a", taskId: "t-a2", source: "analysis" }),
      makeEvent({ id: "user", worksetId: "ws-a", taskId: null, source: "user" }),
    ];
    const sliced = sliceEventsForMonthCard(
      events,
      { kind: "workset", worksetId: "ws-a" },
      { taskIds: ["t-a1"], worksetIds: [] },
      [...TASKS, { id: "t-a2", worksetId: "ws-a" }],
    );
    expect(sliced.map((event) => event.id)).toEqual(["keep"]);
  });

  it("builds titled models from the card list", () => {
    const events = [
      makeEvent({ id: "local-a", worksetId: "ws-a", taskId: "t-a1", source: "user" }),
    ];
    const models = buildMonthCardModels({
      cards: [{ kind: "workset", worksetId: "ws-a" }],
      events,
      selectedSources: { taskIds: [], worksetIds: ["ws-a"] },
      tasks: TASKS,
      worksetTitle: (id) => (id === "ws-a" ? "Alpha" : id),
    });
    expect(models).toEqual([
      {
        kind: "workset",
        worksetId: "ws-a",
        title: "Alpha",
        cover: "",
        events,
      },
    ]);
  });

  it("titles the builtin workset as the display name and subscribe as handle/slug", () => {
    const models = buildMonthCardModels({
      cards: [
        { kind: "workset", worksetId: SYSTEM_WORKSET_ID },
        { kind: "subscribe", key: "Alice/Work" },
      ],
      events: [],
      selectedSources: { taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] },
      worksetTitle: (id) => (id === SYSTEM_WORKSET_ID ? "一般" : id),
    });
    expect(models.map((card) => card.title)).toEqual(["一般", "Alice/Work"]);
  });

  it("fills cover from coverFor and defaults to empty", () => {
    const models = buildMonthCardModels({
      cards: [
        { kind: "workset", worksetId: "ws-a" },
        { kind: "subscribe", key: "DemoPub/Open" },
        { kind: "subscribe", key: "Alice/Work" },
      ],
      events: [],
      selectedSources: { taskIds: [], worksetIds: ["ws-a"] },
      worksetTitle: (id) => id,
      coverFor: (card) => {
        if (card.kind === "workset" && card.worksetId === "ws-a") {
          return "data:image/jpeg;base64,ws";
        }
        if (card.kind === "subscribe" && card.key === "DemoPub/Open") {
          return "data:image/jpeg;base64,sub";
        }
        return "";
      },
    });
    expect(models.map((card) => card.cover)).toEqual([
      "data:image/jpeg;base64,ws",
      "data:image/jpeg;base64,sub",
      "",
    ]);
  });
});
