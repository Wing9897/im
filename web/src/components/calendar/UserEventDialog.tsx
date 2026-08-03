import { useTranslation } from "react-i18next";

import { WorksetTargetSelectField } from "../assistant/WorksetTargetSelect";
import { ModalDialog } from "../ModalDialog";
import { RecurrenceRuleEditor } from "../task/RecurrenceRuleEditor";
import {
  Button,
  FormStack,
  SegmentedControl,
  TextField,
} from "../ui";
import { UserEventTimeSection } from "./UserEventTimeSection";
import { useUserEventDialogForm } from "./useUserEventDialogForm";
import type {
  UserEventFormValues,
  UserEventTaskOption,
} from "./userEventFormModel";

export type { UserEventKind } from "./userEventFormModel";
export type { UserEventFormValues, UserEventTaskOption };

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
        <WorksetTargetSelectField
          aria-label={t("userEvent.taskLabel")}
          value={values.worksetId}
          onChange={(worksetId) => setValues((prev) => ({ ...prev, worksetId }))}
          options={worksetOptions}
          keepStaleOption
          className="w-full"
          data-testid="user-event-workset-select"
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
