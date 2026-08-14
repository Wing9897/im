import type { TFunction } from "i18next";
import i18n from "../../i18n";

type Translate = TFunction | typeof i18n.t;

/** Resolve tasks-page copy via i18n (call during render / at read time). */
export function getTasksPageCopy(t: Translate = i18n.t.bind(i18n)) {
  return {
    pageLabel: String(t("tasks:pageLabel")),
    pageDescription: String(t("tasks:pageDescription")),
    emptyTitle: String(t("tasks:emptyTitle")),
    emptyDescription: String(t("tasks:pageDescription")),
    createLabel: String(t("tasks:createLabel")),
    editLabel: String(t("tasks:editLabel")),
    showSystemTasks: String(t("tasks:showSystemTasks")),
    hideSystemTasks: String(t("tasks:hideSystemTasks")),
    systemSectionTitle: String(t("tasks:systemSectionTitle")),
    systemSectionSubtitle: String(t("tasks:systemSectionSubtitle")),
  };
}

export function getTasksPageLabel(): string {
  return String(i18n.t("tasks:pageLabel"));
}
export function getShowSystemTasksLabel(): string {
  return String(i18n.t("tasks:showSystemTasks"));
}
export function getHideSystemTasksLabel(): string {
  return String(i18n.t("tasks:hideSystemTasks"));
}
export function getSystemTasksSectionTitle(): string {
  return String(i18n.t("tasks:systemSectionTitle"));
}
export function getSystemTasksSectionSubtitle(): string {
  return String(i18n.t("tasks:systemSectionSubtitle"));
}
export function getTasksEmptyTitle(): string {
  return String(i18n.t("tasks:emptyTitle"));
}
export function getTasksEmptyDescription(): string {
  return String(i18n.t("tasks:pageDescription"));
}
