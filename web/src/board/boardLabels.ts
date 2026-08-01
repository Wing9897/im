import i18n from "../i18n";

/** Shared board label when a task name is missing. */
export function unnamedTaskLabel(): string {
  return String(i18n.t("board.common.unnamedTask"));
}

/** Shared board label for untitled list/card titles. */
export function untitledLabel(): string {
  return String(i18n.t("board.common.untitled"));
}
