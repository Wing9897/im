import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { listItems, type TrackableItem } from "../../api/items";
import { WorksetTargetSelectField } from "../assistant/WorksetTargetSelect";
import { ModalDialog } from "../ModalDialog";
import { RecurrenceRuleEditor } from "../task/RecurrenceRuleEditor";
import {
  Button,
  FieldLabel,
  FormStack,
  SegmentedControl,
  SelectField,
  TextField,
} from "../ui";
import { UserEventTimeSection } from "./UserEventTimeSection";
import { useUserEventDialogForm } from "./useUserEventDialogForm";
import type {
  UserEventFormValues,
  UserEventTaskOption,
} from "../../domain/timeline/userEventFormModel";

export type { UserEventKind } from "../../domain/timeline/userEventFormModel";
export type { UserEventFormValues, UserEventTaskOption };

export type ParentItemMode = "hidden" | "readonly" | "editable";

/** Workset picker visibility — hidden when parent item owns workset (Items linked calendars). */
export type WorksetMode = "editable" | "hidden";

type UserEventDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initial?: Partial<UserEventFormValues> | null;
  /** Available worksets (incl. builtin ``__user__``). */
  worksetOptions?: readonly UserEventTaskOption[];
  busy?: boolean;
  error?: string | null;
  /** Optional dialog title (e.g. Desktop ICS import). */
  titleOverride?: string;
  /** Optional intro line under the title. */
  introOverride?: string;
  /**
   * Parent-item association UI.
   * Default ``hidden`` — Items owns linked-calendar create; Timeline only shows
   * read-only when ``itemId`` is already scoped (deep-link / edit).
   */
  parentItemMode?: ParentItemMode;
  /** Default ``editable``; ``hidden`` for item-linked calendar create/edit. */
  worksetMode?: WorksetMode;
  /** Override remind-before-days helper (e.g. category preset prefill). */
  remindBeforeDaysHint?: string;
  onClose: () => void;
  onSubmit: (values: UserEventFormValues) => void;
};

/** User / recurring event create-edit form (timeline Add Event dialog). */
export function UserEventDialog({
  open,
  mode,
  initial,
  worksetOptions = [],
  busy = false,
  error = null,
  titleOverride,
  introOverride,
  parentItemMode = "hidden",
  worksetMode = "editable",
  remindBeforeDaysHint,
  onClose,
  onSubmit,
}: UserEventDialogProps) {
  const { t } = useTranslation("timeline");
  const [itemOptions, setItemOptions] = useState<TrackableItem[]>([]);
  const {
    values,
    setValues,
    localError,
    customDays,
    setCustomDays,
    allowKindSwitch,
    isRecurring,
    kindItems,
    applyDaySpan,
    handleKindChange,
    handleAllDayChange,
    handleSubmit,
    startLabel,
    endLabel,
  } = useUserEventDialogForm({
    open,
    mode,
    initial,
    titleOverride,
    onSubmit,
  });

  useEffect(() => {
    if (!open || parentItemMode === "hidden") return;
    let cancelled = false;
    void listItems({ status: "active" })
      .then((items) => {
        if (!cancelled) setItemOptions(items);
      })
      .catch(() => {
        if (!cancelled) setItemOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, parentItemMode]);

  const lockedItemLabel = (() => {
    const id = values.itemId.trim();
    if (!id) return "";
    const match = itemOptions.find((item) => item.id === id);
    if (!match) return id;
    return match.emoji ? `${match.emoji} ${match.title}` : match.title;
  })();

  const displayError = error ?? localError;
  const introText =
    introOverride ?? (isRecurring ? t("userEvent.introRecurring") : t("userEvent.intro"));

  return (
    <ModalDialog
      open={open}
      title={
        titleOverride ??
        (mode === "create" ? t("userEvent.createTitle") : t("userEvent.editTitle"))
      }
      closeAriaLabel={t("userEvent.closeAria")}
      onClose={onClose}
      testId="user-event-dialog"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t("userEvent.cancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSubmit} disabled={busy}>
            {mode === "create" ? t("userEvent.create") : t("userEvent.save")}
          </Button>
        </>
      }
    >
      <FormStack gap="lg">
        {allowKindSwitch ? (
          <div data-testid="user-event-kind-tabs">
            <SegmentedControl
              items={kindItems}
              value={values.kind}
              onChange={handleKindChange}
              ariaLabel={t("userEvent.kindAria")}
              layout="inline"
            />
          </div>
        ) : null}
        <p className="m-0 text-caption text-text-muted">{introText}</p>
        <TextField
          aria-label={t("userEvent.titleAria")}
          placeholder={t("userEvent.titlePlaceholder")}
          value={values.title}
          onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
          className="w-full"
          required
        />
        {worksetMode === "editable" ? (
          <WorksetTargetSelectField
            aria-label={t("userEvent.taskLabel")}
            value={values.worksetId}
            onChange={(worksetId) => setValues((prev) => ({ ...prev, worksetId }))}
            options={worksetOptions}
            keepStaleOption
            className="w-full"
            data-testid="user-event-workset-select"
          />
        ) : null}

        {parentItemMode === "editable" ? (
          <div className="flex flex-col gap-xs" data-testid="user-event-parent-item">
            <FieldLabel className="mb-0" htmlFor="user-event-item">
              {t("userEvent.parentItem")}
            </FieldLabel>
            {/* Native select: dialog form keeps SelectField for native option list + submit quirks. */}
            <SelectField
              id="user-event-item"
              aria-label={t("userEvent.parentItemAria")}
              value={values.itemId}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, itemId: event.target.value }))
              }
              className="w-full"
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
            <p className="m-0 text-caption text-text-muted">{t("userEvent.parentItemHint")}</p>
          </div>
        ) : null}

        {parentItemMode === "readonly" && values.itemId.trim() ? (
          <div className="flex flex-col gap-xs" data-testid="user-event-parent-item-readonly">
            <FieldLabel className="mb-0">{t("userEvent.parentItem")}</FieldLabel>
            <p className="m-0 text-body text-text-primary">{lockedItemLabel}</p>
            <p className="m-0 text-caption text-text-muted">
              {t("userEvent.parentItemLockedHint")}
            </p>
          </div>
        ) : null}

        <UserEventTimeSection
          values={values}
          setValues={setValues}
          isRecurring={isRecurring}
          startLabel={startLabel}
          endLabel={endLabel}
          customDays={customDays}
          setCustomDays={setCustomDays}
          onAllDayChange={handleAllDayChange}
          onApplyDaySpan={applyDaySpan}
          remindBeforeDaysHint={remindBeforeDaysHint}
        />

        {isRecurring ? (
          <div data-testid="user-event-recurrence">
            <RecurrenceRuleEditor
              value={values.rrule}
              onChange={(rrule) => setValues((prev) => ({ ...prev, rrule }))}
              disabled={busy}
            />
          </div>
        ) : null}

        <TextField
          aria-label={t("userEvent.locationAria")}
          placeholder={t("userEvent.locationPlaceholder")}
          value={values.location}
          onChange={(event) => setValues((prev) => ({ ...prev, location: event.target.value }))}
          className="w-full"
        />
        <TextField
          aria-label={t("userEvent.bodyAria")}
          placeholder={t("userEvent.bodyPlaceholder")}
          value={values.body}
          onChange={(event) => setValues((prev) => ({ ...prev, body: event.target.value }))}
          className="w-full"
        />
        {displayError ? (
          <p className="m-0 text-caption text-error" role="alert">
            {displayError}
          </p>
        ) : null}
      </FormStack>
    </ModalDialog>
  );
}
