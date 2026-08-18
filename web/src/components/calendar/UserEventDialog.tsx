import { useTranslation } from "react-i18next";

import type { UserEventCalendarKind } from "../../domain/timeline/userEventCalendarKind";
import type {
  UserEventFormValues,
  UserEventTaskOption,
} from "../../domain/timeline/userEventFormModel";
import { WorksetTargetSelectField } from "../assistant/WorksetTargetSelect";
import { ModalDialog } from "../ModalDialog";
import { RecurrenceRuleEditor } from "../task/RecurrenceRuleEditor";
import {
  Badge,
  Button,
  FormStack,
  SegmentedControl,
  TextField,
} from "../ui";
import { UserEventDialogFinanceFields } from "./UserEventDialogFinanceFields";
import { UserEventDialogParentItemFields } from "./UserEventDialogParentItemFields";
import { UserEventTimeSection } from "./UserEventTimeSection";
import { useUserEventDialogForm } from "./useUserEventDialogForm";
import { NotifyPrefField } from "../notify/NotifyPrefField";

function specialCalendarKindBadge(
  calendarKind: UserEventCalendarKind,
): { kind: "expires" | "purchase_effective"; tone: "warning" | "info"; testId: string } | null {
  if (calendarKind === "expires") {
    return {
      kind: "expires",
      tone: "warning",
      testId: "user-event-calendar-kind-badge-expires",
    };
  }
  if (calendarKind === "purchase_effective") {
    return {
      kind: "purchase_effective",
      tone: "info",
      testId: "user-event-calendar-kind-badge-purchase-effective",
    };
  }
  return null;
}

export type { UserEventKind } from "../../domain/timeline/userEventFormModel";
export type { UserEventFormValues, UserEventTaskOption };

export type ParentItemMode = "hidden" | "readonly";

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
   * Default ``hidden`` (timeline / schedule / 我的日程 — no picker, no catalog).
   * ``readonly`` is Items-page linked calendars only.
   */
  parentItemMode?: ParentItemMode;
  /** Optional label for ``readonly`` (Items page already has the item). Never fetched. */
  parentItemLabel?: string;
  /** Default ``editable``; ``hidden`` for item-linked calendar create/edit. */
  worksetMode?: WorksetMode;
  /** Override remind-before-days helper (e.g. category preset prefill). */
  remindBeforeDaysHint?: string;
  onClose: () => void;
  onSubmit: (values: UserEventFormValues) => void;
};

function shouldShowFinanceFields(values: UserEventFormValues): boolean {
  return values.calendarKind === "purchase_effective";
}

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
  parentItemLabel = "",
  worksetMode = "editable",
  remindBeforeDaysHint,
  onClose,
  onSubmit,
}: UserEventDialogProps) {
  const { t } = useTranslation("timeline");
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
    handleNowFill,
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

  const lockedItemLabel = parentItemLabel.trim() || values.itemId.trim();

  const displayError = error ?? localError;
  const introText =
    introOverride ?? (isRecurring ? t("userEvent.introRecurring") : t("userEvent.intro"));
  const showFinance = !isRecurring && shouldShowFinanceFields(values);
  const calendarKindBadge = specialCalendarKindBadge(values.calendarKind);

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
        {calendarKindBadge ? (
          <div
            className="flex flex-wrap items-center gap-sm"
            data-testid="user-event-calendar-kind-banner"
          >
            <Badge
              tone={calendarKindBadge.tone}
              className="normal-case tracking-normal"
              data-testid={calendarKindBadge.testId}
            >
              {calendarKindBadge.kind === "expires"
                ? t("userEvent.calendarKindBadge.expires")
                : t("userEvent.calendarKindBadge.purchaseEffective")}
            </Badge>
          </div>
        ) : null}
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

        <UserEventDialogParentItemFields
          mode={parentItemMode}
          values={values}
          lockedItemLabel={lockedItemLabel}
        />

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
          onNowFill={handleNowFill}
          remindBeforeDaysHint={remindBeforeDaysHint}
        />

        <NotifyPrefField
          value={values.notifyPref}
          onChange={(notifyPref) => setValues((prev) => ({ ...prev, notifyPref }))}
        />

        {showFinance ? (
          <UserEventDialogFinanceFields values={values} setValues={setValues} />
        ) : null}

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
