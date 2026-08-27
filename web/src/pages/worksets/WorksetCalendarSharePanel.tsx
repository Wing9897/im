import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertBanner,
  Button,
  SelectField,
  SettingsRow,
  TextField,
} from "../../components/ui";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { captionClass, formHelpClass, sectionTitleClass } from "../../components/ui/pageTypography";
import { SettingsContentCard, SettingsFieldGroup } from "../../components/settings/SettingsFormLayout";
import { useToast } from "../../context/ToastContext";
import {
  fetchCalendarSharePublish,
  fetchCalendarShareSession,
  putCalendarSharePublish,
  type CalendarShareGrant,
  type CalendarShareGrantVisibility,
  type CalendarSharePublishState,
  type CalendarShareVisibility,
} from "../../api/calendarShare";
import { toErrorMessage } from "../../utils/errors";

const DEBOUNCE_MS = 1500;

type GrantDraft = CalendarShareGrant & { key: string };

function defaultSlug(worksetTitle: string, worksetId: string): string {
  const fromTitle = worksetTitle.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (fromTitle && /^[A-Za-z0-9]/.test(fromTitle)) return fromTitle.slice(0, 64);
  const fromId = worksetId.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return fromId.slice(0, 64) || "calendar";
}

type Props = {
  worksetId: string;
  worksetTitle: string;
  isSystem: boolean;
};

/** Workset publish settings: local workset↔slug mapping; remote ACL is SoT on sync. */
export function WorksetCalendarSharePanel({ worksetId, worksetTitle, isSystem }: Props) {
  const { t } = useTranslation("workset");
  const { showToast } = useToast();
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<CalendarSharePublishState | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [publicVisibility, setPublicVisibility] = useState<CalendarShareVisibility>("off");
  const [grants, setGrants] = useState<GrantDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const skipDebounceRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const [session, publish] = await Promise.all([
        fetchCalendarShareSession(),
        fetchCalendarSharePublish(worksetId),
      ]);
      setConnected(session.connected);
      setState(publish);
      setEnabled(publish.enabled);
      setSlug(publish.slug || defaultSlug(worksetTitle, worksetId));
      setAutoSync(publish.autoSync);
      setPublicVisibility(publish.publicVisibility);
      setGrants(
        publish.grants.map((row, index) => ({ ...row, key: `${row.handle}-${index}` })),
      );
      skipDebounceRef.current = true;
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  }, [showToast, worksetId, worksetTitle]);

  useEffect(() => {
    void load();
  }, [load]);

  const payload = useMemo(
    () => ({
      enabled,
      slug: slug.trim(),
      autoSync,
      publicVisibility,
      grants: grants
        .map((row) => ({ handle: row.handle.trim(), visibility: row.visibility }))
        .filter((row) => row.handle.length > 0),
    }),
    [autoSync, enabled, grants, publicVisibility, slug],
  );

  const save = useCallback(
    async (syncNow: boolean) => {
      if (!payload.slug) {
        showToast(t("calendarShare.slugRequired"), "error");
        return;
      }
      setBusy(true);
      try {
        const next = await putCalendarSharePublish(worksetId, { ...payload, syncNow });
        setState(next);
        if (syncNow || next.lastError) {
          if (next.lastError) showToast(next.lastError, "error");
          else showToast(t("calendarShare.synced"), "success");
        }
      } catch (error) {
        showToast(toErrorMessage(error), "error");
      } finally {
        setBusy(false);
      }
    },
    [payload, showToast, t, worksetId],
  );

  useEffect(() => {
    if (skipDebounceRef.current) {
      skipDebounceRef.current = false;
      return;
    }
    if (!autoSync || !enabled || !connected) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void save(true);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoSync, connected, enabled, payload, save]);

  const lastSyncLabel = state?.lastSyncAt
    ? t("calendarShare.lastSync", { time: new Date(state.lastSyncAt).toLocaleString() })
    : t("calendarShare.neverSynced");

  return (
    <SettingsContentCard>
      <SettingsFieldGroup>
        <h2 className={sectionTitleClass}>{t("calendarShare.title")}</h2>
        <p className={`mb-0 ${formHelpClass}`}>{t("calendarShare.help")}</p>

        {isSystem ? (
          <AlertBanner variant="warning" role="alert" data-testid="calendar-share-general-warning">
            {t("calendarShare.generalWarning")}
          </AlertBanner>
        ) : null}

        {!connected ? (
          <p className={`mb-0 ${formHelpClass}`}>{t("calendarShare.needLogin")}</p>
        ) : null}

        <ToggleSwitch
          checked={enabled}
          disabled={!connected || busy}
          onChange={setEnabled}
          label={t("calendarShare.enabled")}
          data-testid="calendar-share-enabled"
        />

        <SettingsRow label={t("calendarShare.slugLabel")} htmlFor="calendar-share-slug" help={t("calendarShare.slugHelp")}>
          <TextField
            id="calendar-share-slug"
            data-testid="calendar-share-slug"
            className="max-w-[280px]"
            value={slug}
            disabled={!connected || busy}
            onChange={(event) => setSlug(event.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t("calendarShare.publicLabel")}
          htmlFor="calendar-share-public"
          help={t("calendarShare.publicHelp")}
        >
          <SelectField
            id="calendar-share-public"
            data-testid="calendar-share-public"
            className="max-w-[220px]"
            value={publicVisibility}
            disabled={!connected || busy}
            onChange={(event) => setPublicVisibility(event.target.value as CalendarShareVisibility)}
          >
            <option value="off">{t("calendarShare.visibilityOff")}</option>
            <option value="busy">{t("calendarShare.visibilityBusy")}</option>
            <option value="details">{t("calendarShare.visibilityDetails")}</option>
          </SelectField>
        </SettingsRow>

        <div className="flex flex-col gap-sm">
          <p className={`m-0 ${captionClass}`}>{t("calendarShare.grantsLabel")}</p>
          {grants.map((row, index) => (
            <div key={row.key} className="flex flex-wrap items-center gap-sm">
              <TextField
                className="max-w-[200px]"
                value={row.handle}
                disabled={!connected || busy}
                placeholder={t("calendarShare.grantHandle")}
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
                disabled={!connected || busy}
                onChange={(event) => {
                  const visibility = event.target.value as CalendarShareGrantVisibility;
                  setGrants((prev) =>
                    prev.map((item) => (item.key === row.key ? { ...item, visibility } : item)),
                  );
                }}
              >
                <option value="busy">{t("calendarShare.visibilityBusy")}</option>
                <option value="details">{t("calendarShare.visibilityDetails")}</option>
              </SelectField>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!connected || busy}
                onClick={() => setGrants((prev) => prev.filter((item) => item.key !== row.key))}
              >
                {t("calendarShare.removeGrant")}
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!connected || busy}
            onClick={() =>
              setGrants((prev) => [...prev, { key: `new-${prev.length}-${Date.now()}`, handle: "", visibility: "details" }])
            }
            data-testid="calendar-share-add-grant"
          >
            {t("calendarShare.addGrant")}
          </Button>
        </div>

        <ToggleSwitch
          checked={autoSync}
          disabled={!connected || busy || !enabled}
          onChange={setAutoSync}
          label={t("calendarShare.autoSync")}
          data-testid="calendar-share-auto-sync"
        />

        <p className={`mb-0 ${formHelpClass}`} data-testid="calendar-share-last-sync">
          {lastSyncLabel}
          {state?.lastError ? ` · ${state.lastError}` : ""}
        </p>

        <div className="flex flex-wrap gap-sm">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!connected || busy || !payload.slug}
            onClick={() => void save(false)}
            data-testid="calendar-share-save"
          >
            {t("calendarShare.save")}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={!connected || busy || !enabled || !payload.slug}
            onClick={() => void save(true)}
            data-testid="calendar-share-sync"
          >
            {busy ? t("calendarShare.syncing") : t("calendarShare.syncNow")}
          </Button>
        </div>
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
