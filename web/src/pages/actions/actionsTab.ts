const ACTIONS_TABS = ["types", "notify", "history"] as const;

export type ActionsTabKey = (typeof ACTIONS_TABS)[number];

export function isActionsTabKey(value: string | null): value is ActionsTabKey {
  return value != null && (ACTIONS_TABS as readonly string[]).includes(value);
}

/** Static tab defs — resolve `labelKey` with `t(labelKey)` at render time. */
export const ACTIONS_TAB_DEFS: ReadonlyArray<{
  id: ActionsTabKey;
  labelKey: string;
}> = [
  { id: "types", labelKey: "tabs.types" },
  { id: "notify", labelKey: "tabs.notify" },
  { id: "history", labelKey: "tabs.history" },
];
