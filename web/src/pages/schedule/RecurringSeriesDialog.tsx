import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getRecurringSeries,
  patchRecurringSeries,
} from "../../api/recurringSeries";
import { NowFillButton } from "../../components/calendar/NowFillButton";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { ModalDialog } from "../../components/ModalDialog";
import { NotifyPrefField } from "../../components/notify/NotifyPrefField";
import { Button, FieldLabel, FormGrid, TextField } from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import { DEFAULT_NOTIFY_PREF, normalizeNotifyPref, type NotifyPref } from "../../domain/notify/notifyPref";
import { fillNowRange } from "../../domain/timeline/nowFill";
import { toErrorMessage } from "../../utils/errors";

type EditorFields = {
  name: string;
  rrule: string;
  eventStartTime: string;
  eventEndTime: string;
  eventLocation: string;
  notifyPref: NotifyPref;
};

const EMPTY_FIELDS: EditorFields = {
  name: "",
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  eventLocation: "",
  notifyPref: DEFAULT_NOTIFY_PREF,
};

type RecurringSeriesDialogProps = {
  seriesId: string;
  open: boolean;
  onClose: () => void;
};

/** In-place editor for one recurring calendar series. Close always calls `onClose`. */
export function RecurringSeriesDialog({ seriesId, open, onClose }: RecurringSeriesDialogProps) {
  const { t } = useTranslation(["schedule", "common"]);
  const { showToast } = useToast();
  const [fields, setFields] = useState<EditorFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !seriesId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getRecurringSeries(seriesId)
      .then((series) => {
        if (cancelled) return;
        setFields({
          name: series.name,
          rrule: series.rrule,
          eventStartTime: series.eventStartTime ?? "",
          eventEndTime: series.eventEndTime ?? "",
          eventLocation: series.eventLocation ?? "",
          notifyPref: normalizeNotifyPref(series.notifyPref),
        });
      })
      .catch((err) => {
        if (!cancelled) setError(toErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, seriesId]);

  const update = (field: keyof EditorFields, value: string) => {
    setFields((prev) => ({ ...prev, [field]: value }));
  };

  const canSave =
    !loading &&
    !saving &&
    Boolean(fields.name.trim()) &&
    Boolean(fields.rrule.trim()) &&
    (!fields.eventEndTime.trim() || Boolean(fields.eventStartTime.trim()));

  const save = async () => {
    if (!canSave || !seriesId) return;
    setSaving(true);
    setError(null);
    try {
      const start = fields.eventStartTime.trim();
      await patchRecurringSeries(seriesId, {
        name: fields.name.trim(),
        rrule: fields.rrule.trim(),
        eventStartTime: start || null,
        eventEndTime: start ? fields.eventEndTime.trim() || null : null,
        eventIsAllDay: !start,
        eventLocation: fields.eventLocation.trim() || null,
        notifyPref: fields.notifyPref,
      });
      showToast(t("toast.recurringUpdated"), "success");
      onClose();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      title={t("editor.title")}
      closeAriaLabel={t("editor.back")}
      onClose={onClose}
      testId="recurring-series-dialog"
      size="form"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t("common:dialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSave}
            onClick={() => {
              void save();
            }}
            data-testid="recurring-series-save"
          >
            {saving ? t("editor.saving") : t("editor.save")}
          </Button>
        </>
      }
    >
      {loading ? <SkeletonScreen variant="list-rows" count={4} /> : null}
      {!loading ? (
        <FormGrid>
          <div className="min-w-0 md:col-span-2">
            <FieldLabel htmlFor="recurring-name">{t("editor.name")}</FieldLabel>
            <TextField
              id="recurring-name"
              value={fields.name}
              onChange={(event) => update("name", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <FieldLabel htmlFor="recurring-rrule">{t("editor.rrule")}</FieldLabel>
            <TextField
              id="recurring-rrule"
              value={fields.rrule}
              onChange={(event) => update("rrule", event.target.value)}
              placeholder="FREQ=WEEKLY;BYDAY=MO"
              disabled={saving}
            />
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor="recurring-start">{t("editor.start")}</FieldLabel>
            <div className="flex min-w-0 items-center gap-xs">
              <TextField
                id="recurring-start"
                type="time"
                value={fields.eventStartTime}
                onChange={(event) => update("eventStartTime", event.target.value)}
                disabled={saving}
                className="min-w-0 flex-1"
              />
              <NowFillButton
                disabled={saving}
                onClick={() => {
                  const range = fillNowRange({ isAllDay: false, clockOnly: true });
                  setFields((prev) => ({
                    ...prev,
                    eventStartTime: range.start,
                    eventEndTime: range.end,
                  }));
                }}
              />
            </div>
          </div>
          <div className="min-w-0">
            <FieldLabel htmlFor="recurring-end">{t("editor.end")}</FieldLabel>
            <TextField
              id="recurring-end"
              type="time"
              value={fields.eventEndTime}
              onChange={(event) => update("eventEndTime", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <FieldLabel htmlFor="recurring-location">{t("editor.location")}</FieldLabel>
            <TextField
              id="recurring-location"
              value={fields.eventLocation}
              onChange={(event) => update("eventLocation", event.target.value)}
              disabled={saving}
            />
          </div>
          <div className="min-w-0 md:col-span-2">
            <NotifyPrefField
              value={fields.notifyPref}
              onChange={(notifyPref) => setFields((prev) => ({ ...prev, notifyPref }))}
              disabled={saving}
            />
          </div>
          {error ? (
            <p className="mt-md text-caption text-error md:col-span-2" role="alert">
              {error}
            </p>
          ) : null}
        </FormGrid>
      ) : null}
    </ModalDialog>
  );
}
