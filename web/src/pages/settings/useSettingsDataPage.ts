import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { runRetentionCleanup } from "../../api/system";
import { saveSystemSettings } from "../../api/config";
import { useToast } from "../../context/ToastContext";
import i18n from "../../i18n";
import { formatMessage } from "../../i18n/formatMessage";
import {
  MSG_RETENTION_DELETED,
  MSG_RETENTION_NONE,
  MSG_RETENTION_PART,
} from "../../i18n/messageKeys";
import { toErrorMessage } from "../../utils/errors";
import type { SystemSettingsSnapshot } from "../../types/settings";
import { useSettingsPageState } from "./SettingsShared";

const RETENTION_FIELDS = [
  "retentionMessagesDays",
  "retentionAnalysisDays",
  "retentionLeaderboardDays",
  "retentionAppLogsDays",
  "retentionUserEventsDays",
] as const;

type RetentionField = (typeof RETENTION_FIELDS)[number];

const DEFAULT_RETENTION: Record<RetentionField, string> = {
  retentionMessagesDays: "90",
  retentionAnalysisDays: "90",
  retentionLeaderboardDays: "90",
  retentionAppLogsDays: "30",
  retentionUserEventsDays: "365",
};

function formatRetentionSummary(deleted: Record<string, number>): string {
  const parts = [
    [i18n.t("settings:data.summary.messages"), deleted.messages],
    [i18n.t("settings:data.summary.analysis"), deleted.analysis],
    [i18n.t("settings:data.summary.leaderboard"), deleted.leaderboard],
    [i18n.t("settings:data.summary.triggerHistory"), deleted.action_trigger_history],
    [i18n.t("settings:data.summary.appLogs"), deleted.app_logs],
    [i18n.t("settings:data.summary.userEvents"), deleted.user_events],
    [i18n.t("settings:data.summary.timelineDismissals"), deleted.timeline_dismissals],
    [i18n.t("settings:data.summary.assistantStores"), deleted.assistant_device_stores],
    [i18n.t("settings:data.summary.deviceAccessTokens"), deleted.device_access_tokens],
    [i18n.t("settings:data.summary.deviceSessions"), deleted.device_sessions],
  ]
    .filter(([, n]) => typeof n === "number" && n > 0)
    .map(([label, n]) => formatMessage(MSG_RETENTION_PART, { label: String(label), count: n as number }));
  return parts.length > 0
    ? formatMessage(MSG_RETENTION_DELETED, {
        parts: parts.join(String(i18n.t("settings:data.summary.separator"))),
      })
    : formatMessage(MSG_RETENTION_NONE);
}

export function useSettingsDataPage() {
  const { showToast } = useToast();
  const [showFullResetConfirm, setShowFullResetConfirm] = useState(false);
  const [showRetentionRunConfirm, setShowRetentionRunConfirm] = useState(false);
  const [runningRetention, setRunningRetention] = useState(false);
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [retentionSaved, setRetentionSaved] = useState(false);
  const [retentionError, setRetentionError] = useState<string | null>(null);
  const retentionSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    settings,
    savedSnapshot,
    updateSettings,
    applyPersistedSnapshot,
    resettingRuntimeData,
    handleRequestFullReset,
  } = useSettingsPageState();

  const retentionValues = useMemo<Record<RetentionField, string>>(
    () => ({
      retentionMessagesDays:
        settings?.retentionMessagesDays ?? DEFAULT_RETENTION.retentionMessagesDays,
      retentionAnalysisDays:
        settings?.retentionAnalysisDays ?? DEFAULT_RETENTION.retentionAnalysisDays,
      retentionLeaderboardDays:
        settings?.retentionLeaderboardDays ?? DEFAULT_RETENTION.retentionLeaderboardDays,
      retentionAppLogsDays:
        settings?.retentionAppLogsDays ?? DEFAULT_RETENTION.retentionAppLogsDays,
      retentionUserEventsDays:
        settings?.retentionUserEventsDays ?? DEFAULT_RETENTION.retentionUserEventsDays,
    }),
    [
      settings?.retentionMessagesDays,
      settings?.retentionAnalysisDays,
      settings?.retentionLeaderboardDays,
      settings?.retentionAppLogsDays,
      settings?.retentionUserEventsDays,
    ],
  );

  const setRetentionField = useCallback(
    (field: RetentionField, value: string) => {
      updateSettings(field, value);
    },
    [updateSettings],
  );

  useEffect(() => {
    return () => {
      if (retentionSavedTimerRef.current !== null) {
        clearTimeout(retentionSavedTimerRef.current);
      }
    };
  }, []);

  const handleSaveRetentionDays = useCallback(async () => {
    const payload: Partial<SystemSettingsSnapshot> = {};
    for (const field of RETENTION_FIELDS) {
      const days = parseInt(retentionValues[field], 10);
      if (Number.isNaN(days) || days < 0) {
        setRetentionError(String(i18n.t("settings:data.retention.invalid")));
        return;
      }
      payload[field] = String(days);
    }
    setRetentionSaving(true);
    setRetentionError(null);
    try {
      const normalized = await saveSystemSettings(payload);
      applyPersistedSnapshot(normalized);
      setRetentionSaved(true);
      if (retentionSavedTimerRef.current !== null) {
        clearTimeout(retentionSavedTimerRef.current);
      }
      retentionSavedTimerRef.current = setTimeout(() => {
        retentionSavedTimerRef.current = null;
        setRetentionSaved(false);
      }, 2000);
    } catch (e) {
      setRetentionError(toErrorMessage(e));
    } finally {
      setRetentionSaving(false);
    }
  }, [retentionValues, applyPersistedSnapshot]);

  const retentionChanged = RETENTION_FIELDS.some(
    (field) => settings?.[field] !== savedSnapshot?.[field],
  );

  const handleConfirmRetentionRun = async () => {
    setRunningRetention(true);
    try {
      const result = await runRetentionCleanup();
      setShowRetentionRunConfirm(false);
      showToast(formatRetentionSummary(result.deleted), "success");
    } catch (e) {
      setShowRetentionRunConfirm(false);
      showToast(toErrorMessage(e), "error");
    } finally {
      setRunningRetention(false);
    }
  };

  return {
    resettingRuntimeData,
    showFullResetConfirm,
    setShowFullResetConfirm,
    showRetentionRunConfirm,
    setShowRetentionRunConfirm,
    runningRetention,
    handleConfirmRetentionRun,
    handleRequestFullReset,
    retentionValues,
    setRetentionField,
    retentionSaving,
    retentionSaved,
    retentionChanged,
    retentionError,
    handleSaveRetentionDays,
  };
}
