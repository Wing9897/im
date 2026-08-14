import type { ComponentType } from "react";
import i18n from "../i18n";
import type { BoardWidgetProps, BoardWidgetType } from "./types";
import type { BoardSizePresetId } from "./boardSizePresets";
import { MapBoardWidget } from "./widgets/MapBoardWidget";
import { CalendarBoardWidget, CalendarDayBoardWidget } from "./widgets/CalendarBoardWidget";
import { GanttBoardWidget } from "./widgets/GanttBoardWidget";
import { GanttEventsBoardWidget } from "./widgets/GanttEventsBoardWidget";
import { EventsBoardWidget } from "./widgets/EventsBoardWidget";
import { FeedBoardWidget } from "./widgets/FeedBoardWidget";
import { QueueBoardWidget } from "./widgets/QueueBoardWidget";
import { WallBoardWidget } from "./widgets/WallBoardWidget";
import { SourcesBoardWidget } from "./widgets/SourcesBoardWidget";
import { LeaderboardBoardWidget } from "./widgets/LeaderboardBoardWidget";
import { ActionsBoardWidget } from "./widgets/ActionsBoardWidget";
import { LogsBoardWidget } from "./widgets/LogsBoardWidget";
import { TasksBoardWidget } from "./widgets/TasksBoardWidget";
import { StatsBoardWidget } from "./widgets/StatsBoardWidget";
import { SystemBoardWidget } from "./widgets/SystemBoardWidget";
import { ClockBoardWidget } from "./widgets/ClockBoardWidget";
import { WeatherBoardWidget } from "./widgets/WeatherBoardWidget";
import { ScheduleBoardWidget } from "./widgets/ScheduleBoardWidget";
import { ItemsBoardWidget } from "./widgets/ItemsBoardWidget";
import { LlmHealthBoardWidget } from "./widgets/LlmHealthBoardWidget";

interface BoardWidgetDescriptor {
  titleKey: string;
  descriptionKey: string;
  component: ComponentType<BoardWidgetProps>;
  /** Allowed phone-widget sizes (cols×rows). */
  sizeOptions: readonly BoardSizePresetId[];
  /** Default size when adding / seeding. */
  defaultSizeId: BoardSizePresetId;
}

/** Every frame offers these sizes in addition to type-specific ones. */
const BOARD_UNIVERSAL_SIZE_OPTIONS = [
  "3x1",
  "4x1",
  "3x2",
  "4x2",
  "5x3",
  "6x4",
] as const satisfies readonly BoardSizePresetId[];

function withUniversalSizes(
  options: readonly BoardSizePresetId[],
): readonly BoardSizePresetId[] {
  const merged = new Set<BoardSizePresetId>([
    ...BOARD_UNIVERSAL_SIZE_OPTIONS,
    ...options,
  ]);
  return [...merged].sort((a, b) => {
    const [aCols, aRows] = a.split("x").map(Number);
    const [bCols, bRows] = b.split("x").map(Number);
    return aCols - bCols || aRows - bRows;
  });
}

/**
 * Per-frame size catalog (type-specific + universal 3x1/4x1/3x2/4x2/5x3/6x4).
 */
export const BOARD_WIDGET_DESCRIPTORS: Record<BoardWidgetType, BoardWidgetDescriptor> = {
  map: {
    titleKey: "board:widgets.map.title",
    descriptionKey: "board:widgets.map.description",
    component: MapBoardWidget,
    sizeOptions: withUniversalSizes(["4x3", "5x5", "6x5", "6x6", "8x5", "8x6", "9x6"]),
    defaultSizeId: "5x3",
  },
  wall: {
    titleKey: "board:widgets.wall.title",
    descriptionKey: "board:widgets.wall.description",
    component: WallBoardWidget,
    sizeOptions: withUniversalSizes(["3x3", "4x3", "4x4", "5x4", "5x5", "6x5", "8x5"]),
    defaultSizeId: "3x3",
  },
  gantt: {
    titleKey: "board:widgets.gantt.title",
    descriptionKey: "board:widgets.gantt.description",
    component: GanttBoardWidget,
    sizeOptions: withUniversalSizes([
      "5x1",
      "6x1",
      "6x2",
      "8x2",
      "10x2",
      "12x2",
      "16x1",
      "16x2",
      "8x3",
    ]),
    defaultSizeId: "16x1",
  },
  "gantt-events": {
    titleKey: "board:widgets.ganttEvents.title",
    descriptionKey: "board:widgets.ganttEvents.description",
    component: GanttEventsBoardWidget,
    sizeOptions: withUniversalSizes([
      "5x1",
      "6x1",
      "6x2",
      "8x2",
      "10x2",
      "12x2",
      "16x1",
      "16x2",
      "8x3",
    ]),
    defaultSizeId: "16x1",
  },
  events: {
    titleKey: "board:widgets.events.title",
    descriptionKey: "board:widgets.events.description",
    component: EventsBoardWidget,
    sizeOptions: withUniversalSizes(["3x4", "3x5", "4x3", "4x4", "4x5", "4x6", "5x4"]),
    defaultSizeId: "4x4",
  },
  feed: {
    titleKey: "board:widgets.feed.title",
    descriptionKey: "board:widgets.feed.description",
    component: FeedBoardWidget,
    sizeOptions: withUniversalSizes(["3x4", "3x5", "4x3", "4x4", "4x5", "4x6", "5x4"]),
    defaultSizeId: "4x4",
  },
  calendar: {
    titleKey: "board:widgets.calendar.title",
    descriptionKey: "board:widgets.calendar.description",
    component: CalendarBoardWidget,
    sizeOptions: withUniversalSizes(["4x3", "6x3"]),
    defaultSizeId: "5x3",
  },
  "calendar-day": {
    titleKey: "board:widgets.calendarDay.title",
    descriptionKey: "board:widgets.calendarDay.description",
    component: CalendarDayBoardWidget,
    sizeOptions: withUniversalSizes(["5x1", "6x1", "6x2"]),
    defaultSizeId: "5x1",
  },
  leaderboard: {
    titleKey: "board:widgets.leaderboard.title",
    descriptionKey: "board:widgets.leaderboard.description",
    component: LeaderboardBoardWidget,
    sizeOptions: withUniversalSizes(["4x3", "4x4", "5x4"]),
    defaultSizeId: "3x2",
  },
  stats: {
    titleKey: "board:widgets.stats.title",
    descriptionKey: "board:widgets.stats.description",
    component: StatsBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "4x3", "5x2"]),
    defaultSizeId: "5x2",
  },
  queue: {
    titleKey: "board:widgets.queue.title",
    descriptionKey: "board:widgets.queue.description",
    component: QueueBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "4x3", "5x2"]),
    defaultSizeId: "3x2",
  },
  system: {
    titleKey: "board:widgets.system.title",
    descriptionKey: "board:widgets.system.description",
    component: SystemBoardWidget,
    sizeOptions: withUniversalSizes(["2x1", "2x2"]),
    defaultSizeId: "3x1",
  },
  clock: {
    titleKey: "board:widgets.clock.title",
    descriptionKey: "board:widgets.clock.description",
    component: ClockBoardWidget,
    sizeOptions: withUniversalSizes(["2x1", "2x2"]),
    defaultSizeId: "3x1",
  },
  weather: {
    titleKey: "board:widgets.weather.title",
    descriptionKey: "board:widgets.weather.description",
    component: WeatherBoardWidget,
    sizeOptions: withUniversalSizes(["4x3", "5x2", "6x2"]),
    defaultSizeId: "5x2",
  },
  sources: {
    titleKey: "board:widgets.sources.title",
    descriptionKey: "board:widgets.sources.description",
    component: SourcesBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x3", "5x1", "6x1"]),
    defaultSizeId: "2x2",
  },
  logs: {
    titleKey: "board:widgets.logs.title",
    descriptionKey: "board:widgets.logs.description",
    component: LogsBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x3", "4x3", "5x1"]),
    defaultSizeId: "3x2",
  },
  tasks: {
    titleKey: "board:widgets.tasks.title",
    descriptionKey: "board:widgets.tasks.description",
    component: TasksBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x3", "4x3"]),
    defaultSizeId: "3x2",
  },
  actions: {
    titleKey: "board:widgets.actions.title",
    descriptionKey: "board:widgets.actions.description",
    component: ActionsBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x3", "5x1"]),
    defaultSizeId: "3x2",
  },
  schedule: {
    titleKey: "board:widgets.schedule.title",
    descriptionKey: "board:widgets.schedule.description",
    component: ScheduleBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x3", "4x3", "5x1"]),
    defaultSizeId: "3x2",
  },
  items: {
    titleKey: "board:widgets.items.title",
    descriptionKey: "board:widgets.items.description",
    component: ItemsBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x3", "4x3", "5x1"]),
    defaultSizeId: "3x2",
  },
  "llm-health": {
    titleKey: "board:widgets.llmHealth.title",
    descriptionKey: "board:widgets.llmHealth.description",
    component: LlmHealthBoardWidget,
    sizeOptions: withUniversalSizes(["2x2", "3x2", "5x1"]),
    defaultSizeId: "2x2",
  },
};

/** Runtime list derived from the descriptor table (order = Object.keys). */
export const BOARD_WIDGET_TYPES = Object.keys(
  BOARD_WIDGET_DESCRIPTORS,
) as BoardWidgetType[];

export const BOARD_WIDGET_COMPONENTS = Object.fromEntries(
  Object.entries(BOARD_WIDGET_DESCRIPTORS).map(([type, desc]) => [type, desc.component]),
) as Record<BoardWidgetType, ComponentType<BoardWidgetProps>>;

export function getWidgetMeta(type: BoardWidgetType): {
  title: string;
  description: string;
  sizeOptions: BoardWidgetDescriptor["sizeOptions"];
  defaultSizeId: BoardWidgetDescriptor["defaultSizeId"];
} {
  const d = BOARD_WIDGET_DESCRIPTORS[type];
  return {
    title: String(i18n.t(d.titleKey)),
    description: String(i18n.t(d.descriptionKey)),
    sizeOptions: d.sizeOptions,
    defaultSizeId: d.defaultSizeId,
  };
}

export function getWidgetDefaultSizeId(type: BoardWidgetType): BoardSizePresetId {
  return BOARD_WIDGET_DESCRIPTORS[type].defaultSizeId;
}

export function getWidgetSizeOptions(type: BoardWidgetType): readonly BoardSizePresetId[] {
  return BOARD_WIDGET_DESCRIPTORS[type].sizeOptions;
}
