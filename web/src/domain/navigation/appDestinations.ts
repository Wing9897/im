/**
 * One destination list for the main sidebar and the command palette.
 * Redirect rules stay in `legacyPaths.ts`. This module only asks that table
 * where a stored path should open.
 */
import {
  applyLegacyRedirect,
  legacyRedirectDestination,
  requireLegacyDestination,
} from "../../routing/legacyPaths";

export type SidebarIconKey =
  | "monitor"
  | "tasks"
  | "worksets"
  | "schedule"
  | "items"
  | "sources"
  | "leaderboard"
  | "intelligence"
  | "timeline"
  | "subscriptions"
  | "notify"
  | "assistant"
  | "ai"
  | "settings"
  | "account";

export type SidebarGroupKey =
  | "groupIntelligence"
  | "groupTime"
  | "groupManage"
  | "groupInteract";

export interface AppDestinationSidebarPlacement {
  /** `null` is the unlabelled first group (實時監控). */
  groupKey: SidebarGroupKey | null;
  icon: SidebarIconKey;
  /** Display order across the whole main sidebar. */
  order: number;
  activePrefix?: string;
  activePrefixes?: readonly string[];
}

export interface AppDestination {
  id: string;
  labelKey: string;
  /** Palette label namespace. Sidebar rows always resolve `labelKey` in `nav`. */
  labelNs?: "nav" | "common";
  /**
   * URLs this destination owns. `paths[0]` is the href.
   * Retired URLs are stored here; do not write the redirected target.
   */
  paths: readonly [string, ...string[]];
  /** Warm `paths[0]` with the main sidebar prefetch set. */
  prefetch: boolean;
  paletteKeywords?: readonly string[];
  sidebar?: AppDestinationSidebarPlacement;
  /** Command palette order. Omit to keep the destination off the palette. */
  paletteOrder?: number;
}

const APP_DESTINATION_LIST = [
  {
    id: "monitor",
    labelKey: "monitor",
    labelNs: "nav",
    paths: ["/monitor"],
    prefetch: true,
    paletteKeywords: ["monitor", "stream"],
    sidebar: { groupKey: "groupManage", icon: "monitor", order: 5 },
    paletteOrder: 0,
  },
  {
    id: "monitor-wall",
    labelKey: "commandPalette.monitorWall",
    paths: ["/monitor?view=wall"],
    prefetch: false,
    paletteKeywords: ["wall", "看板"],
    paletteOrder: 1,
  },
  {
    id: "tasks",
    labelKey: "tasksAndSources",
    labelNs: "nav",
    paths: ["/tasks"],
    prefetch: true,
    paletteKeywords: ["task", "來源", "来源", "sources"],
    sidebar: {
      groupKey: "groupManage",
      icon: "tasks",
      order: 3,
      activePrefixes: ["/tasks", "/sources"],
    },
    paletteOrder: 2,
  },
  {
    id: "worksets",
    labelKey: "worksets",
    labelNs: "nav",
    paths: ["/worksets"],
    prefetch: false,
    paletteKeywords: ["workset", "space", "專區", "专区", "工作集"],
    paletteOrder: 3,
  },
  {
    id: "schedule",
    labelKey: "schedule",
    labelNs: "nav",
    paths: ["/schedule"],
    prefetch: false,
    paletteKeywords: ["schedule", "calendar", "日程", "循环"],
    paletteOrder: 4,
  },
  {
    id: "leaderboard",
    labelKey: "leaderboard",
    labelNs: "nav",
    paths: ["/leaderboard"],
    prefetch: false,
    paletteOrder: 5,
  },
  {
    id: "intelligence",
    labelKey: "keyEvents",
    labelNs: "nav",
    paths: ["/intelligence"],
    prefetch: true,
    paletteKeywords: ["intel"],
    sidebar: { groupKey: "groupTime", icon: "intelligence", order: 1 },
    paletteOrder: 6,
  },
  {
    id: "intelligence-map",
    labelKey: "commandPalette.keyEventsMap",
    paths: ["/intelligence?view=map"],
    prefetch: false,
    paletteKeywords: ["map", "地圖"],
    paletteOrder: 7,
  },
  {
    id: "intelligence-list",
    labelKey: "commandPalette.keyEventsList",
    paths: ["/intelligence?view=list"],
    prefetch: false,
    paletteKeywords: ["list"],
    paletteOrder: 8,
  },
  {
    id: "intelligence-card",
    labelKey: "commandPalette.keyEventsCard",
    paths: ["/intelligence?view=card"],
    prefetch: false,
    paletteKeywords: ["card"],
    paletteOrder: 9,
  },
  {
    id: "timeline",
    labelKey: "timeline",
    labelNs: "nav",
    paths: ["/timeline"],
    prefetch: true,
    sidebar: { groupKey: "groupTime", icon: "timeline", order: 0 },
    paletteOrder: 10,
  },
  {
    id: "items",
    labelKey: "items",
    labelNs: "nav",
    paths: ["/items"],
    prefetch: true,
    sidebar: { groupKey: "groupTime", icon: "items", order: 2, activePrefix: "/items" },
  },
  {
    id: "subscriptions",
    labelKey: "subscriptions",
    labelNs: "nav",
    paths: ["/subscriptions/mine"],
    prefetch: false,
    paletteKeywords: ["subscribe", "calendar", "訂閱", "订阅"],
    paletteOrder: 11,
  },
  {
    id: "subscriptions-published",
    labelKey: "commandPalette.subscriptionsPublished",
    paths: ["/subscriptions/published"],
    prefetch: false,
    paletteKeywords: [
      "publish",
      "unpublish",
      "發佈",
      "发布",
      "上載",
      "上传",
      "私人群組",
      "私人群组",
      "公開閒忙",
      "公开闲忙",
      "private group",
      "public busy",
    ],
    paletteOrder: 12,
  },
  {
    id: "subscriptions-search",
    labelKey: "commandPalette.subscriptionsSearch",
    paths: ["/subscriptions/search"],
    prefetch: false,
    paletteKeywords: ["search", "搜尋", "搜索"],
    paletteOrder: 13,
  },
  {
    id: "subscriptions-account",
    labelKey: "commandPalette.subscriptionsAccount",
    paths: ["/subscriptions/account"],
    prefetch: false,
    paletteKeywords: [
      "login",
      "sign in",
      "calendar share",
      "timezone",
      "登入",
      "登录",
      "日曆分享",
      "日历分享",
      "帳戶",
      "账户",
    ],
    paletteOrder: 14,
  },
  {
    id: "notify",
    labelKey: "notify",
    labelNs: "nav",
    paths: ["/notify"],
    prefetch: true,
    paletteKeywords: ["動作", "动作", "actions", "外發通知", "外发通知", "outbound"],
    sidebar: { groupKey: "groupManage", icon: "notify", order: 4 },
    paletteOrder: 15,
  },
  {
    id: "notify-voice",
    labelKey: "commandPalette.notifyVoice",
    paths: ["/notify?tab=notify"],
    prefetch: false,
    paletteKeywords: [
      "voice",
      "語音",
      "語音提醒",
      "语音提醒",
      "本機通知",
      "本机通知",
      "local notify",
      "通知",
      "提醒",
      "閃現",
      "闪现",
    ],
    paletteOrder: 16,
  },
  {
    id: "notify-history",
    labelKey: "commandPalette.notifyHistory",
    paths: ["/notify?tab=history"],
    prefetch: false,
    paletteKeywords: ["history", "紀錄", "觸發"],
    paletteOrder: 17,
  },
  {
    id: "sources",
    labelKey: "sources",
    labelNs: "nav",
    paths: ["/sources"],
    prefetch: false,
    paletteKeywords: ["source"],
    paletteOrder: 18,
  },
  {
    id: "assistant",
    labelKey: "assistant",
    labelNs: "nav",
    paths: ["/assistant"],
    prefetch: true,
    paletteKeywords: ["assistant", "語音", "chat", "日程", "AI 助手"],
    sidebar: { groupKey: "groupInteract", icon: "assistant", order: 6 },
    paletteOrder: 19,
  },
  {
    id: "sources-rss",
    labelKey: "commandPalette.sourcesRss",
    paths: ["/sources?tab=rss"],
    prefetch: false,
    paletteKeywords: ["rss", "folo"],
    paletteOrder: 20,
  },
  {
    id: "sources-telegram",
    labelKey: "commandPalette.sourcesTelegram",
    paths: ["/sources?tab=telegram"],
    prefetch: false,
    paletteKeywords: ["telegram"],
    paletteOrder: 21,
  },
  {
    id: "sources-discord",
    labelKey: "commandPalette.sourcesDiscord",
    paths: ["/sources?tab=discord"],
    prefetch: false,
    paletteKeywords: ["discord"],
    paletteOrder: 22,
  },
  {
    id: "sources-http",
    labelKey: "commandPalette.sourcesHttp",
    paths: ["/sources?tab=http"],
    prefetch: false,
    paletteKeywords: ["http", "抓取", "poll"],
    paletteOrder: 23,
  },
  {
    id: "sources-http-webhook",
    labelKey: "commandPalette.sourcesHttpWebhook",
    paths: ["/sources?tab=http&mode=webhook"],
    prefetch: false,
    paletteKeywords: ["webhook", "api key", "ingestion"],
    paletteOrder: 24,
  },
  {
    id: "sources-mqtt",
    labelKey: "commandPalette.sourcesMqtt",
    paths: ["/sources?tab=mqtt"],
    prefetch: false,
    paletteKeywords: ["mqtt", "broker"],
    paletteOrder: 25,
  },
  {
    id: "sources-email",
    labelKey: "commandPalette.sourcesEmail",
    paths: ["/sources?tab=email"],
    prefetch: false,
    paletteKeywords: ["email", "imap", "郵件"],
    paletteOrder: 26,
  },
] as const satisfies readonly AppDestination[];

export const APP_DESTINATIONS: readonly AppDestination[] = APP_DESTINATION_LIST;

export type SidebarAppDestination = AppDestination & {
  sidebar: AppDestinationSidebarPlacement;
};

function splitDestinationPath(path: string): { pathname: string; search: string; hash: string } {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  return { pathname, search, hash };
}

/**
 * Href for a manifest path.
 * Bare retired paths go through `requireLegacyDestination`.
 * Retired paths that carry a query (tasks graph: `/worksets?tab=graph`) go
 * through `applyLegacyRedirect`, which keeps the distinguishing query.
 */
export function resolveAppDestinationHref(path: string): string {
  const { pathname, search, hash } = splitDestinationPath(path);
  if (!search && !hash && legacyRedirectDestination(pathname)) {
    return requireLegacyDestination(pathname);
  }
  return applyLegacyRedirect(pathname, search, hash) ?? path;
}

export function appDestinationsInSidebarOrder(): readonly SidebarAppDestination[] {
  return APP_DESTINATIONS.filter((dest): dest is SidebarAppDestination => dest.sidebar != null)
    .slice()
    .sort((a, b) => a.sidebar.order - b.sidebar.order);
}

export function appDestinationsInPaletteOrder(): readonly AppDestination[] {
  return APP_DESTINATIONS.filter(
    (dest): dest is AppDestination & { paletteOrder: number } => dest.paletteOrder != null,
  )
    .slice()
    .sort((a, b) => a.paletteOrder - b.paletteOrder);
}

export function appDestinationPrefetchPaths(): readonly string[] {
  return appDestinationsInSidebarOrder()
    .filter((dest) => dest.prefetch)
    .map((dest) => resolveAppDestinationHref(dest.paths[0]));
}
