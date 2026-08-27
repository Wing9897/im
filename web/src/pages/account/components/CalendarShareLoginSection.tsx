import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, Button, MenuSelect, SettingsRow, TextField } from "../../../components/ui";
import { formHelpClass, sectionTitleClass } from "../../../components/ui/pageTypography";
import { SettingsFieldGroup } from "../../../components/settings/SettingsFormLayout";
import { useToast } from "../../../context/ToastContext";
import {
  fetchCalendarShareSession,
  fetchCalendarShareTimezone,
  loginCalendarShare,
  logoutCalendarShare,
  putCalendarShareTimezone,
  type CalendarShareSession,
  type CalendarShareTimezone,
} from "../../../api/calendarShare";
import { calendarTimezoneOptions, systemIanaTimezone } from "../../../domain/calendar/ianaTimezones";
import { invalidateCalendarShareCatalog } from "../../../domain/calendarShare/useCalendarShareCatalog";
import { toErrorMessage } from "../../../utils/errors";

const DEFAULT_URL = "http://127.0.0.1:8787";

function prefillTimezone(state: CalendarShareTimezone | null): string {
  return (state?.timezone || state?.suggestedTimezone || systemIanaTimezone()).trim();
}

/** Account → Identity: connect to the public calendar-share server (login only). */
export function CalendarShareLoginSection() {
  const { t } = useTranslation("account");
  const { showToast } = useToast();
  const [session, setSession] = useState<CalendarShareSession | null>(null);
  const [timezoneState, setTimezoneState] = useState<CalendarShareTimezone | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [timezoneDraft, setTimezoneDraft] = useState(systemIanaTimezone);
  const [busy, setBusy] = useState(false);
  const [timezoneBusy, setTimezoneBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [nextSession, nextTimezone] = await Promise.all([
        fetchCalendarShareSession(),
        fetchCalendarShareTimezone(),
      ]);
      setSession(nextSession);
      setBaseUrl(nextSession.baseUrl || DEFAULT_URL);
      setHandle(nextSession.handle);
      setTimezoneState(nextTimezone);
      setTimezoneDraft(prefillTimezone(nextTimezone));
      setLoadError(null);
    } catch (error) {
      setLoadError(toErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onLogin = async () => {
    setBusy(true);
    try {
      const next = await loginCalendarShare({ baseUrl, handle, password });
      setSession(next);
      setPassword("");
      invalidateCalendarShareCatalog();
      const nextTimezone = await fetchCalendarShareTimezone();
      setTimezoneState(nextTimezone);
      setTimezoneDraft(prefillTimezone(nextTimezone));
      showToast(t("calendarShare.loggedIn"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      const next = await logoutCalendarShare();
      setSession(next);
      setPassword("");
      invalidateCalendarShareCatalog();
      showToast(t("calendarShare.loggedOut"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const onSaveTimezone = async () => {
    const timezone = timezoneDraft.trim();
    if (!timezone) return;
    setTimezoneBusy(true);
    try {
      const next = await putCalendarShareTimezone(timezone);
      setTimezoneState(next);
      setTimezoneDraft(prefillTimezone(next));
      showToast(t("calendarShare.timezoneSaved"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setTimezoneBusy(false);
    }
  };

  const connected = session?.connected === true;
  const statusLabel = connected ? t("calendarShare.statusConnected") : t("calendarShare.statusDisconnected");
  const timezoneOptions = useMemo(
    () => calendarTimezoneOptions(timezoneState?.suggestedTimezone || timezoneDraft, timezoneDraft),
    [timezoneState?.suggestedTimezone, timezoneDraft],
  );

  return (
    <SettingsFieldGroup>
      <h2 className={sectionTitleClass}>{t("calendarShare.title")}</h2>
      <p className={`mb-0 max-w-[56ch] ${formHelpClass}`}>{t("calendarShare.help")}</p>

      <SettingsRow label={t("calendarShare.urlLabel")} htmlFor="calendar-share-url" help={t("calendarShare.urlHelp")}>
        <TextField
          id="calendar-share-url"
          data-testid="calendar-share-url"
          className="max-w-[420px]"
          value={baseUrl}
          disabled={connected || busy}
          onChange={(event) => setBaseUrl(event.target.value)}
          autoComplete="url"
        />
      </SettingsRow>

      <SettingsRow label={t("calendarShare.handleLabel")} htmlFor="calendar-share-handle">
        <TextField
          id="calendar-share-handle"
          data-testid="calendar-share-handle"
          className="max-w-[320px]"
          value={handle}
          disabled={connected || busy}
          onChange={(event) => setHandle(event.target.value)}
          autoComplete="username"
        />
      </SettingsRow>

      {connected ? null : (
        <SettingsRow label={t("calendarShare.passwordLabel")} htmlFor="calendar-share-password">
          <TextField
            id="calendar-share-password"
            data-testid="calendar-share-password"
            type="password"
            className="max-w-[320px]"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </SettingsRow>
      )}

      <p
        className={`mb-0 ${formHelpClass}`}
        data-testid="calendar-share-status"
        role="status"
      >
        {loadError ?? t("calendarShare.status", { status: statusLabel, handle: session?.handle || "—" })}
      </p>

      <div className="flex flex-wrap gap-sm">
        {connected ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void onLogout()}
            data-testid="calendar-share-logout"
          >
            {busy ? t("calendarShare.loggingOut") : t("calendarShare.logout")}
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={busy || !handle.trim() || !password}
            onClick={() => void onLogin()}
            data-testid="calendar-share-login"
          >
            {busy ? t("calendarShare.loggingIn") : t("calendarShare.login")}
          </Button>
        )}
      </div>

      <SettingsRow
        label={t("calendarShare.timezoneLabel")}
        htmlFor="calendar-share-timezone"
        help={t("calendarShare.timezoneHelp")}
      >
        <MenuSelect
          id="calendar-share-timezone"
          data-testid="calendar-share-timezone"
          variant="field"
          className="max-w-[420px]"
          value={timezoneDraft}
          options={timezoneOptions}
          searchable
          disabled={timezoneBusy}
          onChange={setTimezoneDraft}
          aria-label={t("calendarShare.timezoneLabel")}
        />
      </SettingsRow>

      {timezoneState?.pendingPublicTimezone ? (
        <AlertBanner
          variant="warning"
          role="status"
          className="mb-0 max-w-[56ch]"
          data-testid="calendar-share-timezone-pending"
        >
          {t("calendarShare.timezonePending")}
        </AlertBanner>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={timezoneBusy || !timezoneDraft.trim()}
          onClick={() => void onSaveTimezone()}
          data-testid="calendar-share-timezone-save"
        >
          {timezoneBusy
            ? t("calendarShare.timezoneSaving")
            : timezoneState?.pendingPublicTimezone && connected
              ? t("calendarShare.timezoneRetry")
              : t("calendarShare.timezoneSave")}
        </Button>
      </div>
    </SettingsFieldGroup>
  );
}
