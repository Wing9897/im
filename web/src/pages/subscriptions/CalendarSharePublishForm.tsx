import { useCallback, useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, Button, SelectField, SettingsRow, TextField } from "../../components/ui";
import { formHelpClass, sectionTitleClass, cardBodyClass } from "../../components/ui/pageTypography";
import { TaskLogoMark } from "../../components/task/TaskLogoMark";
import { useToast } from "../../context/ToastContext";
import {
  fetchCalendarSharePublish,
  type CalendarShareGrant,
  type CalendarShareGrantVisibility,
  type CalendarSharePublishState,
  type CalendarShareVisibility,
} from "../../api/calendarShare";
import {
  runCalendarSharePublishPut,
  type CalendarSharePublishResult,
} from "../../domain/calendarShare/publishWorkset";
import {
  SUBSCRIBE_UNAVAILABLE_CLASS,
  subscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";
import { useCalendarShareCatalog } from "../../domain/calendarShare/useCalendarShareCatalog";
import { coercePublishSlug, defaultPublishSlug, isValidPublishSlug } from "../../domain/calendarShare/publishSlug";
import { toErrorMessage } from "../../utils/errors";

type GrantDraft = CalendarShareGrant & { key: string };

export { defaultPublishSlug } from "../../domain/calendarShare/publishSlug";

type Props = {
  worksetId: string;
  worksetTitle: string;
  isSystem: boolean;
  worksetEmoji?: string;
  worksetDescription?: string;
  onSaved?: (result: CalendarSharePublishResult) => void;
  /** Parent footer calls this to save settings and push a remote snapshot. */
  submitRef?: MutableRefObject<(() => Promise<boolean>) | null>;
  onBusyChange?: (busy: boolean) => void;
  onReadyChange?: (ready: boolean) => void;
};

/** Publish settings for one local workset (slug, ACL). Used only on 我的發佈. */
export function CalendarSharePublishForm({
  worksetId,
  worksetTitle,
  isSystem,
  worksetEmoji = "",
  worksetDescription = "",
  onSaved,
  submitRef,
  onBusyChange,
  onReadyChange,
}: Props) {
  const { t } = useTranslation("subscriptions");
  const { showToast } = useToast();
  const catalog = useCalendarShareCatalog();
  const status = subscribePageStatus({
    loading: catalog.loading,
    connected: catalog.session?.connected,
    unreachable: catalog.unreachable,
  });
  const locked = status !== "ok";
  const [state, setState] = useState<CalendarSharePublishState | null>(null);
  const [ready, setReady] = useState(false);
  const [slug, setSlug] = useState("");
  const [publicVisibility, setPublicVisibility] = useState<CalendarShareVisibility>("private_group");
  const [grants, setGrants] = useState<GrantDraft[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const publish = await fetchCalendarSharePublish(worksetId);
      setState(publish);
      setSlug(publish.slug || defaultPublishSlug(worksetTitle, worksetId));
      setPublicVisibility(publish.publicVisibility);
      setGrants((publish.grants ?? []).map((row, index) => ({ ...row, key: `${row.handle}-${index}` })));
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setReady(true);
    }
  }, [showToast, worksetId, worksetTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  useEffect(() => () => onReadyChange?.(false), [onReadyChange]);

  const payload = useMemo(
    () => ({
      slug: slug.trim(),
      publicVisibility,
      grants: grants
        .map((row) => ({ handle: row.handle.trim(), visibility: row.visibility }))
        .filter((row) => row.handle.length > 0),
    }),
    [grants, publicVisibility, slug],
  );

  const save = useCallback(async () => {
    if (locked) return false;
    const slug = coercePublishSlug(payload.slug);
    if (!slug) {
      showToast(t("published.form.slugRequired"), "error");
      return false;
    }
    if (!isValidPublishSlug(slug)) {
      showToast(t("published.form.slugInvalid"), "error");
      return false;
    }
    setBusy(true);
    try {
      const result = await runCalendarSharePublishPut(
        worksetId,
        { ...payload, slug, syncNow: true },
        {
          worksetName: worksetTitle,
          emoji: worksetEmoji,
          description: worksetDescription,
          worksetMissing: false,
        },
      );
      setState(result.state);
      if (!result.published) {
        const failure = result.state.lastError ?? t("published.form.failed");
        showToast(toErrorMessage(failure), "error");
        return false;
      }
      showToast(result.listSynced ? t("published.form.synced") : t("published.listRefreshPending"), result.listSynced ? "success" : "warning");
      onSaved?.(result);
      return true;
    } catch (error) {
      showToast(toErrorMessage(error), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }, [locked, onSaved, payload, showToast, t, worksetDescription, worksetEmoji, worksetId, worksetTitle]);

  useEffect(() => {
    if (!submitRef) return;
    submitRef.current = ready ? save : null;
    return () => {
      if (submitRef.current === save) submitRef.current = null;
    };
  }, [ready, save, submitRef]);

  const lastSyncLabel = state?.lastSyncAt
    ? t("published.form.lastSync", { time: new Date(state.lastSyncAt).toLocaleString() })
    : t("published.form.neverSynced");

  if (!ready || status === "loading") {
    const loading = (
      <p className={`mb-0 ${formHelpClass}`} data-testid="calendar-share-publish-loading" role="status">
        {t("common:ui.loading")}
      </p>
    );
    return loading;
  }

  return (
    <div className="flex flex-col gap-lg">
        <p className={`mb-0 ${formHelpClass}`}>{t("published.form.help")}</p>
        <div className="flex items-start gap-md" data-testid="calendar-share-catalog-preview">
          <TaskLogoMark emoji={worksetEmoji} sizePx={48} testId="calendar-share-catalog-emoji" />
          <div className="min-w-0">
            <p className={`mb-0 ${formHelpClass}`}>{t("published.form.catalogHelp")}</p>
            {worksetDescription.trim() ? (
              <p className={`mb-0 mt-xs line-clamp-2 ${cardBodyClass}`}>{worksetDescription.trim()}</p>
            ) : null}
          </div>
        </div>

        {isSystem ? (
          <AlertBanner variant="warning" role="alert" data-testid="calendar-share-general-warning">
            {t("published.form.generalWarning")}
          </AlertBanner>
        ) : null}

        {status === "loggedOut" ? (
          <p className={`mb-0 ${formHelpClass}`}>{t("published.needLogin")}</p>
        ) : null}

        <div className={locked ? SUBSCRIBE_UNAVAILABLE_CLASS : undefined}>
        <SettingsRow
          label={t("published.form.slugLabel")}
          htmlFor="calendar-share-slug"
          help={t("published.form.slugHelp")}
        >
          <TextField
            id="calendar-share-slug"
            data-testid="calendar-share-slug"
            className="max-w-[280px]"
            value={slug}
            disabled={locked || busy}
            onChange={(event) => setSlug(event.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t("published.form.publicLabel")}
          htmlFor="calendar-share-public"
          help={t("published.form.publicHelp")}
        >
          <SelectField
            id="calendar-share-public"
            data-testid="calendar-share-public"
            className="max-w-[220px]"
            value={publicVisibility}
            disabled={locked || busy}
            onChange={(event) => setPublicVisibility(event.target.value as CalendarShareVisibility)}
          >
            <option value="private_group">{t("visibility.private_group")}</option>
            <option value="public">{t("visibility.public")}</option>
            <option value="public_busy">{t("visibility.public_busy")}</option>
          </SelectField>
        </SettingsRow>

        <div
          className={
            publicVisibility === "private_group"
              ? "flex flex-col gap-sm rounded-lg border border-surface-border p-md"
              : "flex flex-col gap-sm"
          }
          data-testid="calendar-share-grants"
        >
          <div>
            <p className={`m-0 ${sectionTitleClass}`}>{t("published.form.grantsTitle")}</p>
            <p className={`mb-0 ${formHelpClass}`}>
              {publicVisibility === "private_group"
                ? t("published.form.grantsClosedHelp")
                : t("published.form.grantsHelp")}
            </p>
          </div>
          {grants.map((row, index) => (
            <div key={row.key} className="flex flex-wrap items-center gap-sm">
              <TextField
                className="max-w-[200px]"
                value={row.handle}
                disabled={locked || busy}
                placeholder={t("published.form.grantHandle")}
                onChange={(event) => {
                  const handle = event.target.value;
                  setGrants((prev) =>
                    prev.map((item) => (item.key === row.key ? { ...item, handle } : item)),
                  );
                }}
                data-testid={`calendar-share-grant-handle-${index}`}
              />
              <SelectField
                className="max-w-[160px]"
                value={row.visibility}
                disabled={locked || busy}
                onChange={(event) => {
                  const visibility = event.target.value as CalendarShareGrantVisibility;
                  setGrants((prev) =>
                    prev.map((item) => (item.key === row.key ? { ...item, visibility } : item)),
                  );
                }}
              >
                <option value="busy">{t("published.form.grantVisibilityBusy")}</option>
                <option value="details">{t("published.form.grantVisibilityDetails")}</option>
              </SelectField>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={locked || busy}
                onClick={() => setGrants((prev) => prev.filter((item) => item.key !== row.key))}
              >
                {t("published.form.removeGrant")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={locked || busy}
            onClick={() =>
              setGrants((prev) => [
                ...prev,
                { key: `new-${prev.length}-${Date.now()}`, handle: "", visibility: "details" },
              ])
            }
            data-testid="calendar-share-add-grant"
          >
            {t("published.form.addGrant")}
          </Button>
        </div>

        <p className={`mb-0 ${formHelpClass}`} data-testid="calendar-share-last-sync">
          {lastSyncLabel}
          {state?.lastError ? ` · ${toErrorMessage(state.lastError)}` : ""}
        </p>
        </div>
    </div>
  );
}
