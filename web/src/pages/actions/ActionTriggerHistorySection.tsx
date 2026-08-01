import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listActionTriggerHistory } from "../../api/actions";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { useAsyncResource } from "../../hooks/useAsyncResource";
import { useErrorToast } from "../../hooks/useErrorToast";
import type { ActionTriggerHistoryEntry } from "../../types";
import { formatOsDateTime } from "../../utils/time";
import {
  VOICE_REMINDER_HISTORY_CHANGED_EVENT,
  hydrateVoiceReminderHistory,
  loadVoiceReminderTriggers,
  type VoiceReminderTriggerEntry,
} from "../../voiceReminder/triggerHistory";

interface ActionTriggerHistorySectionProps {
  embedded?: boolean;
}

type UnifiedTriggerEntry = {
  id: string;
  source: "action" | "voice_reminder";
  triggerReason: string;
  status: "success" | "failure";
  errorMessage: string | null;
  triggeredAt: string;
};

function toUnifiedFromAction(entry: ActionTriggerHistoryEntry): UnifiedTriggerEntry {
  return {
    id: `action:${entry.id}`,
    source: "action",
    triggerReason: entry.triggerReason,
    status: entry.status,
    errorMessage: entry.errorMessage,
    triggeredAt: entry.triggeredAt,
  };
}

function toUnifiedFromVoice(entry: VoiceReminderTriggerEntry): UnifiedTriggerEntry {
  return {
    id: `voice:${entry.id}`,
    source: "voice_reminder",
    triggerReason: entry.triggerReason,
    status: entry.status,
    errorMessage: entry.errorMessage,
    triggeredAt: entry.triggeredAt,
  };
}

function mergeTriggerEntries(
  actions: ActionTriggerHistoryEntry[],
  voice: VoiceReminderTriggerEntry[],
  limit = 40,
): UnifiedTriggerEntry[] {
  return [...actions.map(toUnifiedFromAction), ...voice.map(toUnifiedFromVoice)]
    .sort(
      (a, b) =>
        new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime(),
    )
    .slice(0, limit);
}

export function ActionTriggerHistorySection({ embedded = false }: ActionTriggerHistorySectionProps) {
  const { t } = useTranslation("actions");
  const fetcher = useCallback(
    () => listActionTriggerHistory({ limit: 20, offset: 0 }),
    [],
  );
  const { data, initialLoading, error, execute } = useAsyncResource(fetcher, {
    toastOnError: false,
  });
  const [voiceEntries, setVoiceEntries] = useState(() => loadVoiceReminderTriggers());
  useErrorToast(error, t("history.loadErrorPrefix"));

  useEffect(() => {
    void execute(undefined);
  }, [execute]);

  useEffect(() => {
    let cancelled = false;
    void hydrateVoiceReminderHistory().then(() => {
      if (!cancelled) setVoiceEntries(loadVoiceReminderTriggers());
    });
    const refreshVoice = () => {
      setVoiceEntries(loadVoiceReminderTriggers());
    };
    window.addEventListener(VOICE_REMINDER_HISTORY_CHANGED_EVENT, refreshVoice);
    window.addEventListener("storage", refreshVoice);
    return () => {
      cancelled = true;
      window.removeEventListener(VOICE_REMINDER_HISTORY_CHANGED_EVENT, refreshVoice);
      window.removeEventListener("storage", refreshVoice);
    };
  }, []);

  const entries = useMemo(
    () => mergeTriggerEntries(data?.items ?? [], voiceEntries),
    [data?.items, voiceEntries],
  );

  const body = initialLoading && entries.length === 0 ? (
    <LoadingSpinner text={t("history.loading")} />
  ) : entries.length === 0 ? (
    <div className="text-body text-text-muted">{t("history.empty")}</div>
  ) : (
    <div className="flex flex-col gap-sm">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-[10px] border border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--surface-base)_50%,transparent)] p-md text-body"
        >
          <div className="flex flex-wrap justify-between gap-sm">
            <span
              className={
                entry.status === "success"
                  ? "font-semibold text-success"
                  : "font-semibold text-error"
              }
            >
              {entry.status === "success"
                ? t("history.statusSuccess")
                : t("history.statusFailure")}{" "}
              · {entry.triggerReason}
            </span>
            <span className="text-caption text-text-muted">
              {formatOsDateTime(entry.triggeredAt)}
            </span>
          </div>
          {entry.errorMessage ? (
            <div className="mt-1 text-caption text-error">{entry.errorMessage}</div>
          ) : null}
        </div>
      ))}
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <section className="mt-2xl">
      <h3 className="mb-md text-section-title font-semibold text-text-primary">
        {t("history.title")}
      </h3>
      {body}
    </section>
  );
}
