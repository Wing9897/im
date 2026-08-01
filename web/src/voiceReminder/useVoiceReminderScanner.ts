import { useContext, useEffect, useRef } from "react";
import { fetchCalendarOccurrences, fetchTimelineEvents } from "../api/results";
import { listUserEvents } from "../api/userEvents";
import { ToastContext } from "../context/ToastContext";
import { useTaskCatalog, useTaskNameById } from "../context/TaskCatalogContext";
import {
  resolveAnalysisTaskIdsFromFilter,
  type SourceFilterSelection,
  type WorksetMemberTask,
} from "../domain/tasks/sourceFilterSelection";
import i18n from "../i18n";
import { createSpeechPorts, loadVoiceSettings, ttsSpeakOptionsFromVoiceSettings } from "../speech";
import { logWarn } from "../utils/logger";
import { announceVoiceReminder, voiceReminderSpeakFailedMessage, voiceReminderTtsUnavailableMessage } from "./announce";
import {
  SCAN_INTERVAL_MS,
  collectDueReminders,
  computeFetchRange,
  filterEventsBySourceFilter,
  formatLeadSpeakPhrase,
  getMaxLeadMinutes,
  hydrateFiredKeys,
  isWithinQuietHours,
  loadFiredKeys,
  claimFiredKeys,
  mergeTimedKeyEventsById,
  pruneFiredKeys,
  saveFiredKeys,
  toTimedKeyEvents,
  userEventsToTimedKeyEvents,
  type DueReminder,
} from "./scanner";
import {
  VOICE_REMINDER_SETTINGS_CHANGED_EVENT,
  hydrateVoiceReminderSettings,
  loadVoiceReminderSettings,
} from "./settings";
import {
  appendVoiceReminderTrigger,
  buildVoiceReminderTriggerReason,
  hydrateVoiceReminderHistory,
} from "./triggerHistory";

/** Concrete task ids for server-side calendar/events filters (`null` selection = all sources). */
function serverTaskIdsForFetch(
  selection: SourceFilterSelection,
  catalogTasks: readonly WorksetMemberTask[],
): string[] | undefined {
  return resolveAnalysisTaskIdsFromFilter(selection, catalogTasks) ?? undefined;
}

async function recordDueTrigger(
  item: DueReminder,
  status: "success" | "failure",
  errorMessage?: string,
): Promise<boolean> {
  const { persisted } = await appendVoiceReminderTrigger({
    triggerReason: buildVoiceReminderTriggerReason(
      item.title,
      formatLeadSpeakPhrase(item.leadOffsetMinutes),
    ),
    status,
    ...(errorMessage ? { errorMessage } : {}),
    eventId: item.eventId,
    title: item.title,
    leadOffsetMinutes: item.leadOffsetMinutes,
  });
  return persisted;
}

/**
 * Background voice-reminder scanner for timed 關鍵事件、循環任務 RRULE 展開、
 * 以及用戶／助手事件。Mount once near the app root.
 */
export function useVoiceReminderScanner(): void {
  const runningRef = useRef(false);
  const hydratedRef = useRef(false);
  const toastContext = useContext(ToastContext);

  // Read through a ref: the scan effect owns a long-lived interval and must not
  // be torn down and restarted every time the shared task catalog refreshes.
  const catalogTaskNames = useTaskNameById();
  const catalogTaskNamesRef = useRef(catalogTaskNames);
  useEffect(() => {
    catalogTaskNamesRef.current = catalogTaskNames;
  }, [catalogTaskNames]);

  const { tasks: catalogTasks } = useTaskCatalog();
  const catalogTasksRef = useRef<readonly WorksetMemberTask[]>(catalogTasks);
  useEffect(() => {
    catalogTasksRef.current = catalogTasks;
  }, [catalogTasks]);

  useEffect(() => {
    let cancelled = false;

    const notifyPersistFailure = (message: string) => {
      logWarn(message);
      toastContext?.showToast(
        String(i18n.t("actions:voice.saveFailed")),
        "error",
      );
    };

    const persistFired = async (firedKeys: ReadonlySet<string>) => {
      const ok = await saveFiredKeys(firedKeys);
      if (!ok) {
        notifyPersistFailure("[voiceReminder] failed to persist fired keys");
      }
    };

    const runScan = async () => {
      if (cancelled || runningRef.current || !hydratedRef.current) {
        return;
      }
      runningRef.current = true;
      try {
        const settings = loadVoiceReminderSettings();
        if (!settings.enabled || settings.leadOffsetsMinutes.length === 0) {
          return;
        }

        const nowMs = Date.now();
        if (
          settings.quietHours.enabled &&
          isWithinQuietHours(new Date(nowMs), settings.quietHours)
        ) {
          return;
        }
        const maxLead = getMaxLeadMinutes(settings.leadOffsetsMinutes);
        const { rangeStart, rangeEnd } = computeFetchRange(nowMs, maxLead);
        // When the selection names concrete tasks/worksets, push task_ids to
        // calendar／events (same server filter timeline already uses). `__user__`-only
        // → empty list so analysis/RRULE fetches short-circuit; user_events stay
        // client-filtered.
        const serverTaskIds = serverTaskIdsForFetch(settings.sourceFilter, catalogTasksRef.current);

        let analysisRows;
        let userRows;
        let calendarRows;
        try {
          [analysisRows, userRows, calendarRows] = await Promise.all([
            fetchTimelineEvents({
              startDate: rangeStart,
              endDate: rangeEnd,
              ...(serverTaskIds !== undefined ? { taskIds: serverTaskIds } : {}),
            }),
            listUserEvents({ start: rangeStart, end: rangeEnd }),
            fetchCalendarOccurrences(
              rangeStart,
              rangeEnd,
              {
                ...(serverTaskIds !== undefined ? { taskIds: serverTaskIds } : {}),
                includeItems: false,
              },
            ),
          ]);
        } catch (error) {
          logWarn("[voiceReminder] failed to fetch reminder sources", error);
          return;
        }
        if (cancelled) {
          return;
        }

        const taskNameById = new Map<string, string>(catalogTaskNamesRef.current);
        for (const row of [...analysisRows, ...calendarRows]) {
          if (row.taskId && row.taskName) {
            taskNameById.set(row.taskId, row.taskName);
          }
        }

        const events = filterEventsBySourceFilter(
          mergeTimedKeyEventsById(
            toTimedKeyEvents(analysisRows, "event"),
            userEventsToTimedKeyEvents(userRows, taskNameById),
            toTimedKeyEvents(calendarRows, "recurring"),
          ),
          settings.sourceFilter,
          catalogTasksRef.current,
        );

        let firedKeys = pruneFiredKeys(loadFiredKeys(), nowMs);
        const due = collectDueReminders({
          events,
          leadOffsetsMinutes: settings.leadOffsetsMinutes,
          nowMs,
          firedKeys,
        });

        if (due.length === 0) {
          await persistFired(firedKeys);
          return;
        }

        const claimedKeys = await claimFiredKeys(due.map((item) => item.dedupeKey));
        if (cancelled) {
          return;
        }
        firedKeys = loadFiredKeys();
        const toAnnounce = due.filter((item) => claimedKeys.has(item.dedupeKey));
        if (toAnnounce.length === 0) {
          return;
        }

        const voice = loadVoiceSettings();
        const { tts } = createSpeechPorts();
        if (!tts.isAvailable()) {
          logWarn("[voiceReminder] TTS unavailable; skipping speak");
          for (const item of toAnnounce) {
            const persisted = await recordDueTrigger(
              item,
              "failure",
              voiceReminderTtsUnavailableMessage(),
            );
            if (!persisted) {
              notifyPersistFailure("[voiceReminder] failed to persist trigger history");
            }
          }
          return;
        }

        for (const item of toAnnounce) {
          if (cancelled) {
            break;
          }
          try {
            await announceVoiceReminder(tts, item.speakText, {
              ...ttsSpeakOptionsFromVoiceSettings(voice),
            });
            const persisted = await recordDueTrigger(item, "success");
            if (!persisted) {
              notifyPersistFailure("[voiceReminder] failed to persist trigger history");
            }
          } catch (error) {
            logWarn("[voiceReminder] speak failed", error);
            const persisted = await recordDueTrigger(
              item,
              "failure",
              error instanceof Error ? error.message : voiceReminderSpeakFailedMessage(),
            );
            if (!persisted) {
              notifyPersistFailure("[voiceReminder] failed to persist trigger history");
            }
          }
        }
      } finally {
        runningRef.current = false;
      }
    };

    const onSettingsChanged = () => {
      void runScan();
    };

    void (async () => {
      try {
        await Promise.all([
          hydrateVoiceReminderSettings(),
          hydrateFiredKeys(),
          hydrateVoiceReminderHistory(),
        ]);
      } catch (error) {
        logWarn("[voiceReminder] hydrate failed", error);
      }
      if (cancelled) {
        return;
      }
      hydratedRef.current = true;
      void runScan();
    })();

    const timer = window.setInterval(() => {
      void runScan();
    }, SCAN_INTERVAL_MS);
    window.addEventListener(VOICE_REMINDER_SETTINGS_CHANGED_EVENT, onSettingsChanged);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(
        VOICE_REMINDER_SETTINGS_CHANGED_EVENT,
        onSettingsChanged,
      );
    };
  }, [toastContext]);
}
