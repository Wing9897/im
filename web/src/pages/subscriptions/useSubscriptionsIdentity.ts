import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MenuSelectOption } from "../../components/ui";
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

export const DEFAULT_CALENDAR_SHARE_URL = "https://subscribe.devents.tech";

function prefillTimezone(state: CalendarShareTimezone | null): string {
  return (state?.timezone || state?.suggestedTimezone || systemIanaTimezone()).trim();
}

export function formatServerLabel(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) return "—";
  try {
    const parsed = new URL(trimmed);
    return parsed.host || trimmed;
  } catch {
    return trimmed;
  }
}

export function useSubscriptionsIdentity() {
  const { t } = useTranslation("subscriptions");
  const { t: tCommon } = useTranslation("common");
  const { showToast } = useToast();
  const { profile } = useUserProfile();
  const catalog = useCalendarShareCatalog();
  const session = catalog.session;
  const [timezoneState, setTimezoneState] = useState<CalendarShareTimezone | null>(null);
  const [baseUrl, setBaseUrl] = useState(DEFAULT_CALENDAR_SHARE_URL);
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
    setBaseUrl(session.baseUrl || DEFAULT_CALENDAR_SHARE_URL);
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
  const statusMessage = timezoneError ?? catalog.error ?? null;
  const timezoneOptions = useMemo(
    (): readonly MenuSelectOption[] =>
      calendarTimezoneOptions(timezoneState?.suggestedTimezone || timezoneDraft, timezoneDraft),
    [timezoneState?.suggestedTimezone, timezoneDraft],
  );
  const timezoneSaveLabel = timezoneBusy
    ? t("identity.timezoneSaving")
    : connected && timezoneState?.pendingPublicTimezone
      ? t("identity.timezoneRetry")
      : t("identity.timezoneSave");

  return {
    t,
    connected,
    busy,
    baseUrl,
    setBaseUrl,
    handle,
    setHandle,
    password,
    setPassword,
    onLogin,
    onLogout,
    localDisplayName,
    localAvatar,
    shareHandle,
    shareAvatar,
    serverLabel,
    statusMessage,
    timezoneDraft,
    setTimezoneDraft,
    timezoneOptions,
    timezoneBusy,
    timezoneSaveLabel,
    pendingPublicTimezone: Boolean(timezoneState?.pendingPublicTimezone),
    onSaveTimezone,
  };
}
