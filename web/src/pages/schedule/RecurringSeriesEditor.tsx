import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

import {
  getRecurringSeries,
  patchRecurringSeries,
} from "../../api/recurringSeries";
import { useToast } from "../../context/ToastContext";
import {
  AppPageShell,
  Button,
  FieldLabel,
  FormGrid,
  SurfaceCard,
  TextField,
} from "../../components/ui";
import {
  pageChromeActionsClass,
  pageChromeBackButtonClass,
  pageChromeInnerClass,
  pageChromeOuterClass,
  pageChromeTitleClass,
  pageChromeTitleClusterClass,
  stickyChromePageFillClass,
} from "../../components/ui/pageChrome";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { NowFillButton } from "../../components/calendar/NowFillButton";
import { NotifyPrefField } from "../../components/notify/NotifyPrefField";
import { DEFAULT_NOTIFY_PREF, normalizeNotifyPref, type NotifyPref } from "../../domain/notify/notifyPref";
import { fillNowRange } from "../../domain/timeline/nowFill";
import { toErrorMessage } from "../../utils/errors";

type EditorFields = {
  name: string;
  rrule: string;
  eventStartTime: string;
  eventEndTime: string;
  eventLocation: string;
  itemId: string;
  notifyPref: NotifyPref;
};

const EMPTY_FIELDS: EditorFields = {
  name: "",
  rrule: "",
  eventStartTime: "",
  eventEndTime: "",
  eventLocation: "",
  itemId: "",
  notifyPref: DEFAULT_NOTIFY_PREF,
};

export function RecurringSeriesEditor() {
  const { t } = useTranslation("schedule");
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [fields, setFields] = useState<EditorFields>(EMPTY_FIELDS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getRecurringSeries(id)
      .then((series) => {
        if (cancelled) return;
        setFields({
          name: series.name,
          rrule: series.rrule,
          eventStartTime: series.eventStartTime ?? "",
          eventEndTime: series.eventEndTime ?? "",
          eventLocation: series.eventLocation ?? "",
          itemId: series.itemId ?? "",
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
  }, [id]);

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
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const start = fields.eventStartTime.trim();
      await patchRecurringSeries(id, {
        name: fields.name.trim(),
        rrule: fields.rrule.trim(),
        eventStartTime: start || null,
        eventEndTime: start ? fields.eventEndTime.trim() || null : null,
        eventIsAllDay: !start,
        eventLocation: fields.eventLocation.trim() || null,
        itemId: fields.itemId.trim() || null,
        notifyPref: fields.notifyPref,
      });
      showToast(t("toast.recurringUpdated"), "success");
      navigate("/schedule");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={stickyChromePageFillClass}>
      <header className={pageChromeOuterClass} data-testid="recurring-series-editor-toolbar">
        <div className={pageChromeInnerClass}>
          <div className={pageChromeTitleClusterClass}>
            <Button
              variant="ghost"
              size="icon"
              className={pageChromeBackButtonClass}
              onClick={() => navigate("/schedule")}
              aria-label={t("editor.back")}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </Button>
            <h1 className={pageChromeTitleClass}>{t("editor.title")}</h1>
          </div>
          <div className={pageChromeActionsClass}>
            <Button
              variant="primary"
              size="sm"
              disabled={!canSave}
              onClick={() => {
                void save();
              }}
              data-testid="recurring-series-save"
            >
              {saving ? t("editor.saving") : t("editor.save")}
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 overflow-y-auto">
        <AppPageShell>
          {loading ? <SkeletonScreen variant="list-rows" count={4} /> : null}
          {!loading ? (
            <SurfaceCard className="p-xl">
              <FormGrid>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="recurring-name">{t("editor.name")}</FieldLabel>
                  <TextField
                    id="recurring-name"
                    value={fields.name}
                    onChange={(event) => update("name", event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="md:col-span-2">
                  <FieldLabel htmlFor="recurring-rrule">{t("editor.rrule")}</FieldLabel>
                  <TextField
                    id="recurring-rrule"
                    value={fields.rrule}
                    onChange={(event) => update("rrule", event.target.value)}
                    placeholder="FREQ=WEEKLY;BYDAY=MO"
                    disabled={saving}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="recurring-start">{t("editor.start")}</FieldLabel>
                  <div className="flex items-center gap-xs">
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
                <div>
                  <FieldLabel htmlFor="recurring-end">{t("editor.end")}</FieldLabel>
                  <TextField
                    id="recurring-end"
                    type="time"
                    value={fields.eventEndTime}
                    onChange={(event) => update("eventEndTime", event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="recurring-location">{t("editor.location")}</FieldLabel>
                  <TextField
                    id="recurring-location"
                    value={fields.eventLocation}
                    onChange={(event) => update("eventLocation", event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="recurring-item">{t("editor.itemId")}</FieldLabel>
                  <TextField
                    id="recurring-item"
                    value={fields.itemId}
                    onChange={(event) => update("itemId", event.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="md:col-span-2">
                  <NotifyPrefField
                    value={fields.notifyPref}
                    onChange={(notifyPref) =>
                      setFields((prev) => ({ ...prev, notifyPref }))
                    }
                    disabled={saving}
                  />
                </div>
              </FormGrid>
              {error ? (
                <p className="mt-md text-caption text-danger" role="alert">
                  {error}
                </p>
              ) : null}
            </SurfaceCard>
          ) : null}
        </AppPageShell>
      </div>
    </div>
  );
}
