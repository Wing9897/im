import type { TFunction } from "i18next";
import i18n from "../../i18n";
import type { AnalysisMode } from "../../types";
import type { AiStaffId } from "../aiStaff/aiStaff";
import liaisonAvatarSrc from "../../assets/ai-staff/liaison.png";

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

/** localStorage key for DashboardViewer「顯示系統任務」toggle (default false). */
export const SHOW_SYSTEM_TASKS_STORAGE_KEY = "im:tasks:show-system-tasks";

/** localStorage key for /tasks analysis mode filter chip (default `"all"`). */
export const TASKS_MODE_FILTER_STORAGE_KEY = "im:tasks:mode-filter";

/** localStorage: task detail dialog keeps channel list expanded. */
export const TASKS_DETAIL_CHANNELS_EXPANDED_STORAGE_KEY =
  "im:tasks:detail:channels-expanded";

/** sessionStorage key for /tasks toolbar search draft (debounced writes). */
export const TASKS_SEARCH_STORAGE_KEY = "im:tasks:search";

export type TasksModeFilter = AnalysisMode | "all";

const TASKS_MODE_FILTER_VALUES = new Set<string>([
  "all",
  "leaderboard",
  "event",
  "recurring",
  "calendar_task",
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
