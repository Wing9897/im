import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { getAppLocale, onAppLocaleChange } from "./locale";
import zhHantCommon from "./locales/zh-Hant/common.json";
import zhHantTasks from "./locales/zh-Hant/tasks.json";
import zhHantBoard from "./locales/zh-Hant/board.json";
import zhHantNav from "./locales/zh-Hant/nav.json";
import zhHantActions from "./locales/zh-Hant/actions.json";
import zhHantIntelligence from "./locales/zh-Hant/intelligence.json";
import zhHantMonitor from "./locales/zh-Hant/monitor.json";
import zhHantSources from "./locales/zh-Hant/sources.json";
import zhHantTimeline from "./locales/zh-Hant/timeline.json";
import zhHantSettings from "./locales/zh-Hant/settings.json";
import zhHantAssistant from "./locales/zh-Hant/assistant.json";
import zhHantLogs from "./locales/zh-Hant/logs.json";
import zhHantItems from "./locales/zh-Hant/items.json";
import zhHantSchedule from "./locales/zh-Hant/schedule.json";
import zhHantAccount from "./locales/zh-Hant/account.json";
import zhHantWorkset from "./locales/zh-Hant/workset.json";
import zhHantViewer from "./locales/zh-Hant/viewer.json";
import zhHantLeaderboard from "./locales/zh-Hant/leaderboard.json";
import zhHansCommon from "./locales/zh-Hans/common.json";
import zhHansTasks from "./locales/zh-Hans/tasks.json";
import zhHansBoard from "./locales/zh-Hans/board.json";
import zhHansNav from "./locales/zh-Hans/nav.json";
import zhHansActions from "./locales/zh-Hans/actions.json";
import zhHansIntelligence from "./locales/zh-Hans/intelligence.json";
import zhHansMonitor from "./locales/zh-Hans/monitor.json";
import zhHansSources from "./locales/zh-Hans/sources.json";
import zhHansTimeline from "./locales/zh-Hans/timeline.json";
import zhHansSettings from "./locales/zh-Hans/settings.json";
import zhHansAssistant from "./locales/zh-Hans/assistant.json";
import zhHansLogs from "./locales/zh-Hans/logs.json";
import zhHansItems from "./locales/zh-Hans/items.json";
import zhHansSchedule from "./locales/zh-Hans/schedule.json";
import zhHansAccount from "./locales/zh-Hans/account.json";
import zhHansWorkset from "./locales/zh-Hans/workset.json";
import zhHansViewer from "./locales/zh-Hans/viewer.json";
import zhHansLeaderboard from "./locales/zh-Hans/leaderboard.json";
import enCommon from "./locales/en/common.json";
import enTasks from "./locales/en/tasks.json";
import enBoard from "./locales/en/board.json";
import enNav from "./locales/en/nav.json";
import enActions from "./locales/en/actions.json";
import enIntelligence from "./locales/en/intelligence.json";
import enMonitor from "./locales/en/monitor.json";
import enSources from "./locales/en/sources.json";
import enTimeline from "./locales/en/timeline.json";
import enSettings from "./locales/en/settings.json";
import enAssistant from "./locales/en/assistant.json";
import enLogs from "./locales/en/logs.json";
import enItems from "./locales/en/items.json";
import enSchedule from "./locales/en/schedule.json";
import enAccount from "./locales/en/account.json";
import enWorkset from "./locales/en/workset.json";
import enViewer from "./locales/en/viewer.json";
import enLeaderboard from "./locales/en/leaderboard.json";

export const defaultNS = "common";

export const NAMESPACES = [
  "common",
  "tasks",
  "board",
  "nav",
  "actions",
  "intelligence",
  "monitor",
  "sources",
  "timeline",
  "settings",
  "assistant",
  "logs",
  "items",
  "schedule",
  "account",
  "workset",
  "viewer",
  "leaderboard",
] as const;

export const resources = {
  "zh-Hant": {
    common: zhHantCommon,
    tasks: zhHantTasks,
    board: zhHantBoard,
    nav: zhHantNav,
    actions: zhHantActions,
    intelligence: zhHantIntelligence,
    monitor: zhHantMonitor,
    sources: zhHantSources,
    timeline: zhHantTimeline,
    settings: zhHantSettings,
    assistant: zhHantAssistant,
    logs: zhHantLogs,
    items: zhHantItems,
    schedule: zhHantSchedule,
    account: zhHantAccount,
    workset: zhHantWorkset,
    viewer: zhHantViewer,
    leaderboard: zhHantLeaderboard,
  },
  "zh-Hans": {
    common: zhHansCommon,
    tasks: zhHansTasks,
    board: zhHansBoard,
    nav: zhHansNav,
    actions: zhHansActions,
    intelligence: zhHansIntelligence,
    monitor: zhHansMonitor,
    sources: zhHansSources,
    timeline: zhHansTimeline,
    settings: zhHansSettings,
    assistant: zhHansAssistant,
    logs: zhHansLogs,
    items: zhHansItems,
    schedule: zhHansSchedule,
    account: zhHansAccount,
    workset: zhHansWorkset,
    viewer: zhHansViewer,
    leaderboard: zhHansLeaderboard,
  },
  en: {
    common: enCommon,
    tasks: enTasks,
    board: enBoard,
    nav: enNav,
    actions: enActions,
    intelligence: enIntelligence,
    monitor: enMonitor,
    sources: enSources,
    timeline: enTimeline,
    settings: enSettings,
    assistant: enAssistant,
    logs: enLogs,
    items: enItems,
    schedule: enSchedule,
    account: enAccount,
    workset: enWorkset,
    viewer: enViewer,
    leaderboard: enLeaderboard,
  },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: getAppLocale(),
  fallbackLng: "zh-Hant",
  defaultNS,
  ns: [...NAMESPACES],
  interpolation: {
    escapeValue: false,
    prefix: "{",
    suffix: "}",
  },
  // Locale comes from getAppLocale() (fixed preference or resolved `auto`).
  react: { useSuspense: false },
});

onAppLocaleChange((locale) => {
  if (i18n.language !== locale) {
    void i18n.changeLanguage(locale);
  }
});

export default i18n;
