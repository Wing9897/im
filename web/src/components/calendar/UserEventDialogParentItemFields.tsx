import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import type { TrackableItem } from "../../api/items";
import type { UserEventFormValues } from "../../domain/timeline/userEventFormModel";
import { FieldLabel, SelectField } from "../ui";

type ParentItemMode = "hidden" | "readonly" | "editable";

type UserEventDialogParentItemFieldsProps = {
  mode: ParentItemMode;
  values: UserEventFormValues;
  setValues: Dispatch<SetStateAction<UserEventFormValues>>;
  itemOptions: TrackableItem[];
  lockedItemLabel: string;
};

/** Parent-item association UI (editable select or read-only lock). */
export function UserEventDialogParentItemFields({
  mode,
  values,
  setValues,
  itemOptions,
  lockedItemLabel,
}: UserEventDialogParentItemFieldsProps) {
  const { t } = useTranslation("timeline");

  if (mode === "editable") {
    return (
      <div className="flex min-w-0 flex-col gap-xs" data-testid="user-event-parent-item">
        <div className="flex min-w-0 items-center gap-md">
          <FieldLabel className="mb-0 min-w-0 flex-1" htmlFor="user-event-item">
            {t("userEvent.parentItem")}
          </FieldLabel>
          <SelectField
            id="user-event-item"
            aria-label={t("userEvent.parentItemAria")}
            value={values.itemId}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, itemId: event.target.value }))
            }
            wrapperClassName="w-[16rem] max-w-full shrink-0"
            data-testid="user-event-item-select"
          >
          <option value="">{t("userEvent.parentItemNone")}</option>
          {itemOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.emoji ? `${item.emoji} ` : ""}
              {item.title}
            </option>
          ))}
          </SelectField>
        </div>
        <p className="m-0 text-caption text-text-muted">{t("userEvent.parentItemHint")}</p>
      </div>
    );
  }

  if (mode === "readonly" && values.itemId.trim()) {
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

  return null;
}
