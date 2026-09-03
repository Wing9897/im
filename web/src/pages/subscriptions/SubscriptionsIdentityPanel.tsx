import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertBanner,
  Badge,
  Button,
  MenuSelect,
  SettingsRow,
  SurfaceCard,
  TextField,
  type MenuSelectOption,
} from "../../components/ui";
import { cardTitleClass, formHelpClass } from "../../components/ui/pageTypography";
import { IdentityAvatar } from "../../components/user/IdentityAvatar";
import { useToast } from "../../context/ToastContext";
import {
  fetchCalendarShareTimezone,
  loginCalendarShare,
  logoutCalendarShare,
  putCalendarShareProfile,
  putCalendarShareTimezone,
  type CalendarShareTimezone,
} from "../../api/calendarShare";
import { calendarTimezoneOptions, systemIanaTimezone } from "../../domain/calendar/ianaTimezones";
import { useCalendarShareCatalog } from "../../domain/calendarShare/useCalendarShareCatalog";
import { resolveUserDisplayName, useUserProfile } from "../../domain/user/userProfile";
import { resolveIdentityAvatar } from "../../domain/user/identityAvatar";
import { toErrorMessage } from "../../utils/errors";

const DEFAULT_URL = "https://subscribe.devents.tech";

function prefillTimezone(state: CalendarShareTimezone | null): string {
  return (state?.timezone || state?.suggestedTimezone || systemIanaTimezone()).trim();
}

function formatServerLabel(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "—";
  try {
    const parsed = new URL(trimmed);
    return parsed.host || trimmed;
  } catch {
    return trimmed;
  }
}

function IdentityTimezoneFields({
  timezoneLabel,
  timezoneHelp,
  timezonePending,
  saveLabel,
  timezoneDraft,
  timezoneOptions,
  timezoneBusy,
  pendingPublicTimezone,
  onDraftChange,
  onSave,
}: {
  timezoneLabel: string;
  timezoneHelp: string;
  timezonePending: string;
  saveLabel: string;
  timezoneDraft: string;
  timezoneOptions: readonly MenuSelectOption[];
  timezoneBusy: boolean;
  pendingPublicTimezone: boolean;
  onDraftChange: (value: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-col gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] pt-md">
      <SettingsRow
        label={timezoneLabel}
        htmlFor="calendar-share-timezone"
        help={timezoneHelp}
      >
        <MenuSelect
          id="calendar-share-timezone"
          data-testid="calendar-share-timezone"
          variant="field"
          menuPortal
          className="max-w-[420px]"
          value={timezoneDraft}
          options={timezoneOptions}
          searchable
          disabled={timezoneBusy}
          onChange={onDraftChange}
          aria-label={timezoneLabel}
        />
      </SettingsRow>

      {pendingPublicTimezone ? (
        <AlertBanner
          variant="warning"
          role="status"
          className="mb-0 max-w-[56ch]"
          data-testid="calendar-share-timezone-pending"
        >
          {timezonePending}
        </AlertBanner>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={timezoneBusy || !timezoneDraft.trim()}
          onClick={onSave}
          data-testid="calendar-share-timezone-save"
        >
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

/** Subscriptions workspace identity chrome: calendar-share login, avatar, and timezone. */
export function SubscriptionsIdentityPanel() {
  const { t } = useTranslation("subscriptions");
  const { t: tCommon } = useTranslation("common");
  const { showToast } = useToast();
  const { profile } = useUserProfile();
  const catalog = useCalendarShareCatalog();
  const session = catalog.session;
  const [timezoneState, setTimezoneState] = useState<CalendarShareTimezone | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_URL);
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [timezoneDraft, setTimezoneDraft] = useState(systemIanaTimezone);
  const [busy, setBusy] = useState(false);
  const [timezoneBusy, setTimezoneBusy] = useState(false);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);

  const localDisplayName = resolveUserDisplayName(profile, tCommon("account:defaultName"));
  const localAvatar = resolveIdentityAvatar(localDisplayName, profile.avatarDataUrl);
  const lastSyncedAvatarRef = useRef<string | null>(null);

  const syncAvatarToIc = useCallback(
    async (avatarDataUrl: string | null | undefined) => {
      if (!session?.connected) return;
      const normalized = (avatarDataUrl ?? "").trim();
      if (lastSyncedAvatarRef.current === normalized) return;
      try {
        await putCalendarShareProfile(normalized);
        lastSyncedAvatarRef.current = normalized;
      } catch {
        // Best-effort replica; local profile remains authoritative.
      }
    },
    [session?.connected],
  );

  const loadTimezone = useCallback(async () => {
    try {
      const nextTimezone = await fetchCalendarShareTimezone();
      setTimezoneState(nextTimezone);
      setTimezoneDraft(prefillTimezone(nextTimezone));
      setTimezoneError(null);
    } catch (error) {
      setTimezoneError(toErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    void loadTimezone();
  }, [loadTimezone]);

  useEffect(() => {
    if (!session) return;
    setBaseUrl(session.baseUrl || DEFAULT_URL);
    setHandle(session.handle);
  }, [session]);

  useEffect(() => {
    if (session?.connected) {
      void syncAvatarToIc(profile.avatarDataUrl);
    } else {
      lastSyncedAvatarRef.current = null;
    }
  }, [session?.connected, profile.avatarDataUrl, syncAvatarToIc]);

  const onLogin = async () => {
    setBusy(true);
    try {
      await loginCalendarShare({ baseUrl, handle, password });
      setPassword("");
      void catalog.invalidate();
      await catalog.refresh();
      await loadTimezone();
      await syncAvatarToIc(profile.avatarDataUrl);
      showToast(t("identity.loggedIn"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setBusy(false);
    }
  };

  const onLogout = async () => {
    setBusy(true);
    try {
      await logoutCalendarShare();
      setPassword("");
      void catalog.invalidate();
      await catalog.refresh();
      showToast(t("identity.loggedOut"), "success");
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
      showToast(t("identity.timezoneSaved"), "success");
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setTimezoneBusy(false);
    }
  };

  const connected = session?.connected === true;
  const serverLabel = formatServerLabel(session?.baseUrl || baseUrl);
  const shareHandle = session?.handle?.trim() || handle.trim();
  const shareAvatar = resolveIdentityAvatar(
    shareHandle || localDisplayName,
    connected ? profile.avatarDataUrl : null,
  );
  const statusMessage =
    timezoneError ?? catalog.error ?? null;
  const timezoneOptions = useMemo(
    () => calendarTimezoneOptions(timezoneState?.suggestedTimezone || timezoneDraft, timezoneDraft),
    [timezoneState?.suggestedTimezone, timezoneDraft],
  );
  const timezoneFields = (
    <IdentityTimezoneFields
      timezoneLabel={t("identity.timezoneLabel")}
      timezoneHelp={t("identity.timezoneHelp")}
      timezonePending={t("identity.timezonePending")}
      saveLabel={
        timezoneBusy
          ? t("identity.timezoneSaving")
          : connected && timezoneState?.pendingPublicTimezone
            ? t("identity.timezoneRetry")
            : t("identity.timezoneSave")
      }
      timezoneDraft={timezoneDraft}
      timezoneOptions={timezoneOptions}
      timezoneBusy={timezoneBusy}
      pendingPublicTimezone={Boolean(timezoneState?.pendingPublicTimezone)}
      onDraftChange={setTimezoneDraft}
      onSave={() => void onSaveTimezone()}
    />
  );

  if (connected) {
    return (
      <SurfaceCard
        density="field"
        material="elevated"
        className="flex flex-col gap-md"
        data-testid="subscriptions-identity-panel"
        data-connected="true"
      >
        <div className="flex flex-wrap items-center gap-md">
          <IdentityAvatar
            label={shareAvatar.label}
            src={shareAvatar.imageSrc}
            size="lg"
            testId="subscriptions-identity-avatar"
          />
          <div className="min-w-0 flex-1">
            <p className={`mb-0 truncate ${cardTitleClass}`} data-testid="subscriptions-identity-handle">
              {shareHandle || "—"}
            </p>
            <div className="mt-xs flex flex-wrap items-center gap-xs">
              <Badge tone="success" data-testid="subscriptions-identity-status">
                {t("identity.statusConnected")}
              </Badge>
              <span className="truncate text-caption text-text-muted" data-testid="subscriptions-identity-server">
                {serverLabel}
              </span>
            </div>
            <p className={`mb-0 mt-xs ${formHelpClass}`}>{t("identity.localDevice", { name: localDisplayName })}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={busy}
            disabled={busy}
            onClick={() => void onLogout()}
            data-testid="calendar-share-logout"
          >
            {busy ? t("identity.loggingOut") : t("identity.logout")}
          </Button>
        </div>

        {statusMessage ? (
          <p className={`mb-0 ${formHelpClass} text-error`} role="alert" data-testid="calendar-share-status">
            {statusMessage}
          </p>
        ) : null}

        {timezoneFields}
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard
      density="default"
      material="elevated"
      enter="rise-soft"
      className="flex flex-col gap-md"
      data-testid="subscriptions-identity-panel"
      data-connected="false"
    >
      <div className="flex flex-wrap items-start gap-md">
        <IdentityAvatar
          label={localAvatar.label}
          src={localAvatar.imageSrc}
          size="lg"
          testId="subscriptions-identity-avatar"
        />
        <div className="min-w-0 flex-1">
          <h2 className={`mb-xs ${cardTitleClass}`}>{t("identity.title")}</h2>
          <p className={`mb-0 max-w-[56ch] ${formHelpClass}`}>{t("identity.help")}</p>
          <p className={`mb-0 mt-xs ${formHelpClass}`}>{t("identity.localDevice", { name: localDisplayName })}</p>
        </div>
      </div>

      <div className="grid gap-md md:grid-cols-2">
        <SettingsRow label={t("identity.urlLabel")} htmlFor="calendar-share-url" help={t("identity.urlHelp")}>
          <TextField
            id="calendar-share-url"
            data-testid="calendar-share-url"
            value={baseUrl}
            placeholder={DEFAULT_URL}
            disabled={busy}
            onChange={(event) => setBaseUrl(event.target.value)}
            autoComplete="url"
          />
        </SettingsRow>

        <SettingsRow label={t("identity.handleLabel")} htmlFor="calendar-share-handle">
          <TextField
            id="calendar-share-handle"
            data-testid="calendar-share-handle"
            value={handle}
            disabled={busy}
            onChange={(event) => setHandle(event.target.value)}
            autoComplete="username"
          />
        </SettingsRow>

        <SettingsRow label={t("identity.passwordLabel")} htmlFor="calendar-share-password">
          <TextField
            id="calendar-share-password"
            data-testid="calendar-share-password"
            type="password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </SettingsRow>
      </div>

      {statusMessage ? (
        <p className={`mb-0 ${formHelpClass}`} data-testid="calendar-share-status" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-sm">
        <Button
          type="button"
          variant="primary"
          size="md"
          loading={busy}
          disabled={busy || !handle.trim() || !password}
          onClick={() => void onLogin()}
          data-testid="calendar-share-login"
        >
          {busy ? t("identity.loggingIn") : t("identity.login")}
        </Button>
      </div>

      {timezoneFields}
    </SurfaceCard>
  );
}
