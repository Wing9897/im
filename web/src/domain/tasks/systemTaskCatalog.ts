import type { TFunction } from "i18next";
import i18n from "../../i18n";
import type { AnalysisMode } from "../../types";
import type { AiStaffId } from "../aiStaff/aiStaff";
import liaisonAvatarSrc from "../../assets/ai-staff/liaison.png";
export {
  TASKS_GROUPING_VIEW_STORAGE_KEY,
  SHOW_SYSTEM_TASKS_STORAGE_KEY,
  SHOW_SYSTEM_WORKSETS_STORAGE_KEY,
  TASKS_MODE_FILTER_STORAGE_KEY,
  TASKS_DETAIL_CHANNELS_EXPANDED_STORAGE_KEY,
  TASKS_SEARCH_STORAGE_KEY,
} from "../prefs";

/** Kind of read-only system / virtual / agent info card on /tasks. */
export type SystemTaskKind = "virtual" | "system" | "agent";

export interface SystemTaskInfo {
  id: string;
  title: string;
  kind: SystemTaskKind;
  shortDescription: string;
  /** Optional related AI staff avatar on the card. */
  staffId?: AiStaffId;
  /** Custom avatar when not a roster AiStaffId (e.g. A2A 客戶經理). */
  avatarSrc?: string;
  /** Optional in-app path shown as a secondary link on the card. */
  linkTo?: string;
  linkLabel?: string;
}

export type TasksGroupingView = "by_task" | "by_workset";

export function isTasksGroupingView(value: string | null): value is TasksGroupingView {
  return value === "by_task" || value === "by_workset";
}

export type TasksModeFilter = AnalysisMode | "all";

const TASKS_MODE_FILTER_VALUES = new Set<string>([
  "all",
  "leaderboard",
  "intel_event",
  "agent",
]);

export function isTasksModeFilter(value: string | null): value is TasksModeFilter {
  return value !== null && TASKS_MODE_FILTER_VALUES.has(value);
}

type Translate = TFunction | typeof i18n.t;

interface SystemTaskDef {
  id: string;
  kind: SystemTaskKind;
  titleKey: string;
  descriptionKey: string;
  staffId?: AiStaffId;
  avatarSrc?: string;
  linkTo?: string;
  linkLabelKey?: string;
}

const SYSTEM_TASK_DEFS: readonly SystemTaskDef[] = [
  {
    id: "user-or-assistant",
    kind: "virtual",
    titleKey: "systemTasks.userOrAssistant.title",
    descriptionKey: "systemTasks.userOrAssistant.shortDescription",
    staffId: "assistant",
  },
  {
    id: "client-manager",
    kind: "agent",
    titleKey: "systemTasks.clientManager.title",
    descriptionKey: "systemTasks.clientManager.shortDescription",
    avatarSrc: liaisonAvatarSrc,
    linkTo: "/settings/api",
    linkLabelKey: "systemTasks.clientManager.linkLabel",
  },
  {
    id: "collector",
    kind: "system",
    titleKey: "systemTasks.collector.title",
    descriptionKey: "systemTasks.collector.shortDescription",
  },
  {
    id: "analysis-batch",
    kind: "system",
    titleKey: "systemTasks.analysisBatch.title",
    descriptionKey: "systemTasks.analysisBatch.shortDescription",
  },
  {
    id: "outbound-notify",
    kind: "system",
    titleKey: "systemTasks.outboundNotify.title",
    descriptionKey: "systemTasks.outboundNotify.shortDescription",
  },
  {
    id: "voice-reminder",
    kind: "system",
    titleKey: "systemTasks.voiceReminder.title",
    descriptionKey: "systemTasks.voiceReminder.shortDescription",
    linkTo: "/actions?tab=voice",
    linkLabelKey: "systemTasks.voiceReminder.linkLabel",
  },
  {
    id: "retention",
    kind: "system",
    titleKey: "systemTasks.retention.title",
    descriptionKey: "systemTasks.retention.shortDescription",
  },
  {
    id: "startup-geocode",
    kind: "system",
    titleKey: "systemTasks.startupGeocode.title",
    descriptionKey: "systemTasks.startupGeocode.shortDescription",
  },
];

/**
 * Localized catalog of virtual / system mechanisms shown as read-only cards.
 * Not AnalysisTask rows — no edit / delete / toggle.
 */
export function getSystemTaskCatalog(t: Translate = i18n.t.bind(i18n)): SystemTaskInfo[] {
  return SYSTEM_TASK_DEFS.map((def) => ({
    id: def.id,
    kind: def.kind,
    title: String(t(def.titleKey)),
    shortDescription: String(t(def.descriptionKey)),
    staffId: def.staffId,
    avatarSrc: def.avatarSrc,
    linkTo: def.linkTo,
    linkLabel: def.linkLabelKey ? String(t(def.linkLabelKey)) : undefined,
  }));
}
