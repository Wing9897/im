import { useTranslation } from "react-i18next";

import type { UserEventFormValues } from "../../domain/timeline/userEventFormModel";
import { FieldLabel } from "../ui";

type ParentItemMode = "hidden" | "readonly";

type UserEventDialogParentItemFieldsProps = {
  mode: ParentItemMode;
  values: UserEventFormValues;
  /** Display label when known (Items page). Never resolved via items catalog. */
  lockedItemLabel: string;
};

/**
 * Parent-item association UI for Items-page linked calendars only.
 * Calendar / 我的日程 surfaces keep ``mode="hidden"`` — no picker, no catalog fetch.
 */
export function UserEventDialogParentItemFields({
  mode,
  values,
  lockedItemLabel,
}: UserEventDialogParentItemFieldsProps) {
  const { t } = useTranslation("timeline");

  if (mode !== "readonly" || !values.itemId.trim()) return null;

  return (
    <div className="flex flex-col gap-xs" data-testid="user-event-parent-item-readonly">
      <FieldLabel className="mb-0">{t("userEvent.parentItem")}</FieldLabel>
      <p className="m-0 text-body text-text-primary">{lockedItemLabel}</p>
      <p className="m-0 text-caption text-text-muted">
        {t("userEvent.parentItemLockedHint")}
      </p>
    </div>
  );
}
