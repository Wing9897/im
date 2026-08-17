import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../../api/userEvents";
import type { LinkedCalendarQuickKind } from "../../../domain/items/linkedCalendarQuickCreate";
import { ItemFormCvSection } from "./ItemFormCvSection";
import {
  itemFormEmptyHintClass,
  itemFormSecondaryHintClass,
  itemFormSectionBodyClass,
} from "./itemFormClasses";
import { ITEM_FORM_CHIP_GRID_CLASS } from "./ItemFormIconChip";
import { LinkedCalendarAddControl } from "./LinkedCalendarAddControl";
import { LinkedCalendarIconChip } from "./LinkedCalendarIconChip";
import { useLinkedCalendarRows } from "./useLinkedCalendarRows";

type Props = {
  /** Parent item id; null in create mode (section visible but add disabled). */
  itemId: string | null;
  /** Bump to reload after an in-place create/edit/delete. */
  refreshKey?: number;
  disabled?: boolean;
  /** When false in create mode, add chips stay disabled (e.g. missing title). */
  canAdd?: boolean;
  /** Category preset for remind-before-days prefill on linked calendar create. */
  categoryDefaultRemindBeforeDays?: number | null;
  /** Quick add presets → same create dialog. */
  onQuickAdd?: (kind: LinkedCalendarQuickKind) => void;
  /** Edit a one-off linked user event (same dialog as Timeline). */
  onEditOneOff?: (event: UserEvent) => void;
  /** Hard-delete a one-off linked user event (incl. expiry). */
  onDeleteOneOff?: (event: UserEvent) => void;
  /** Hard-delete a recurring series linked to this item. */
  onDeleteRecurring?: (seriesId: string, title: string) => void;
  /** Notify parent when primary linked expiry changes. */
  onActiveExpiryChange?: (event: UserEvent | null) => void;
};

/** Lists one-off + recurring calendars linked to an inventory item + CTA to add. */
export function ItemFormLinkedCalendarsSection({
  itemId,
  refreshKey = 0,
  disabled = false,
  canAdd = true,
  categoryDefaultRemindBeforeDays = null,
  onQuickAdd,
  onEditOneOff,
  onDeleteOneOff,
  onDeleteRecurring,
  onActiveExpiryChange,
}: Props) {
  const { t } = useTranslation("items");
  const {
    rows,
    activeExpiry,
    expiresCount,
    loading,
    loadError,
    createLocked,
  } = useLinkedCalendarRows({
    itemId,
    refreshKey,
    onActiveExpiryChange,
  });

  const showGrid = createLocked || (!loading && !loadError);
  const showEmptyHint = showGrid && !createLocked && !loading && !loadError && rows.length === 0;
  const chipsDisabled = disabled || !canAdd;
  /** Create mode without a title: one short line; chips stay disabled. Auto-save needs no essay. */
  const showTitleRequiredHint = createLocked && !canAdd;
  const markPrimaryExpiry = expiresCount > 1;
  const primaryExpiryId = activeExpiry?.id ?? null;

  return (
    <ItemFormCvSection
      title={t("sectionLinkedCalendars")}
      testId="item-form-linked-calendars"
      ariaLabel={t("sectionLinkedCalendars")}
    >
      <div className={itemFormSectionBodyClass}>
        {!createLocked && loading ? (
          <p className={itemFormEmptyHintClass}>{t("linkedCalendarsLoading")}</p>
        ) : null}

        {!createLocked && loadError ? (
          <p className="m-0 text-caption leading-normal text-error" role="alert">
            {t("linkedCalendarsLoadFailed")}
          </p>
        ) : null}

        {showGrid && (createLocked || (!loading && !loadError)) ? (
          <div
            className={ITEM_FORM_CHIP_GRID_CLASS}
            data-testid="item-form-linked-calendar-grid"
            aria-label={t("linkedCalendarGridAria")}
          >
            {!createLocked
              ? rows.map((row) => (
                  <LinkedCalendarIconChip
                    key={row.id}
                    row={row}
                    primaryExpiryId={primaryExpiryId}
                    markPrimaryExpiry={markPrimaryExpiry}
                    disabled={chipsDisabled}
                    onEdit={onEditOneOff}
                    onDeleteOneOff={onDeleteOneOff}
                    onDeleteRecurring={onDeleteRecurring}
                  />
                ))
              : null}

            {onQuickAdd || createLocked ? (
              <LinkedCalendarAddControl disabled={chipsDisabled} onPick={onQuickAdd} />
            ) : null}
          </div>
        ) : null}

        {showTitleRequiredHint ? (
          <p
            className={itemFormSecondaryHintClass}
            data-testid="item-form-linked-calendars-create-hint"
          >
            {t("linkedCalendarsTitleRequiredHint")}
          </p>
        ) : null}

        {showEmptyHint ? (
          <p className={itemFormEmptyHintClass} data-testid="item-form-linked-calendars-empty">
            {t("linkedCalendarsEmpty")}
          </p>
        ) : null}

        {categoryDefaultRemindBeforeDays != null && categoryDefaultRemindBeforeDays > 0 ? (
          <p
            className={itemFormSecondaryHintClass}
            data-testid="item-form-linked-remind-prefill-hint"
          >
            {t("linkedCalendarRemindPrefillHint", { days: categoryDefaultRemindBeforeDays })}
          </p>
        ) : null}
      </div>
    </ItemFormCvSection>
  );
}
