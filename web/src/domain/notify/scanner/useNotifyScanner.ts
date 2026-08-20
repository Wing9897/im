import { useContext, useEffect, useRef } from "react";
import { ToastContext } from "../../../context/ToastContext";
import { useTaskCatalog, useTaskNameById } from "../../../context/TaskCatalogContext";
import i18n from "../../../i18n";
import type { AnalysisTask } from "../../../types/tasks";
import { logWarn } from "../../../utils/logger";
import { deliverDueReminders } from "./scannerAnnounce";
import { claimDueForAnnounce, persistFiredKeys } from "./scannerClaim";
import {
  buildFilteredReminderEvents,
  fetchReminderSourceRows,
  mergeCatalogTaskNames,
  seriesNotifyMap,
} from "./scannerFetch";
import {
  SCAN_INTERVAL_MS,
  collectDueReminders,
  computeFetchRange,
  getMaxLeadMinutes,
  hydrateFiredKeys,
  isWithinQuietHours,
  loadFiredKeys,
  pruneFiredKeys,
} from "./scanner";
import {
  NOTIFY_SETTINGS_CHANGED_EVENT,
  hydrateNotifySettings,
  loadNotifySettings,
  normalizeNotifySettings,
  reminderChannelDelivery,
} from "./settings";
import { hydrateNotifyHistory } from "./triggerHistory";

/**
 * Background reminder scanner for timed 情報事件、週期任務 RRULE 展開、
 * 用戶／助手事件，以及物品到期／提醒日。Mount once near the app root.
 */
export function useNotifyScanner(): void {
  const runningRef = useRef(false);
  const hydratedRef = useRef(false);
  const toastContext = useContext(ToastContext);

  const catalogTaskNames = useTaskNameById();
  const catalogTaskNamesRef = useRef(catalogTaskNames);
  useEffect(() => {
    catalogTaskNamesRef.current = catalogTaskNames;
  }, [catalogTaskNames]);

  const { tasks: catalogTasks, worksets, worksetsLoading, tasksLoading } = useTaskCatalog();
  const catalogTasksRef = useRef<readonly AnalysisTask[]>(catalogTasks);
  useEffect(() => {
    catalogTasksRef.current = catalogTasks;
  }, [catalogTasks]);
  const worksetsRef = useRef(worksets);
  useEffect(() => {
    worksetsRef.current = worksets;
  }, [worksets]);
  const worksetsLoadingRef = useRef(worksetsLoading);
  const tasksLoadingRef = useRef(tasksLoading);
  worksetsLoadingRef.current = worksetsLoading;
  tasksLoadingRef.current = tasksLoading;
  const runScanRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;

    const notifyPersistFailure = (message: string) => {
      logWarn(message);
      toastContext?.showToast(
        String(i18n.t("actions:voice.saveFailed")),
        "error",
      );
    };

    const runScan = async () => {
      if (cancelled || runningRef.current || !hydratedRef.current) {
        return;
      }
      if (worksetsLoadingRef.current || tasksLoadingRef.current) {
        return;
      }
      runningRef.current = true;
      try {
        const settings = normalizeNotifySettings(loadNotifySettings());
        if (!settings.enabled || settings.leadOffsetsMinutes.length === 0) {
          return;
        }

        const nowMs = Date.now();
        const quietHoursActive =
          settings.quietHours.enabled &&
          isWithinQuietHours(new Date(nowMs), settings.quietHours);
        if (quietHoursActive) {
          return;
        }
        const maxLead = getMaxLeadMinutes(settings.leadOffsetsMinutes);
        const { rangeStart, rangeEnd } = computeFetchRange(nowMs, maxLead);

        const windowItems = await fetchReminderSourceRows(rangeStart, rangeEnd);
        if (!windowItems || cancelled) {
          return;
        }

        const taskNameById = mergeCatalogTaskNames(
          catalogTaskNamesRef.current,
          windowItems,
        );
        const seriesById = await seriesNotifyMap();
        if (cancelled) {
          return;
        }

        const events = buildFilteredReminderEvents({
          windowItems,
          taskNameById,
          globalEnabled: settings.enabled,
          quietHoursActive,
          worksets: worksetsRef.current,
          catalogTasks: catalogTasksRef.current,
          seriesById,
        });

        let firedKeys = pruneFiredKeys(loadFiredKeys(), nowMs);
        const due = collectDueReminders({
          events,
          leadOffsetsMinutes: settings.leadOffsetsMinutes,
          nowMs,
          firedKeys,
        });

        if (due.length === 0) {
          await persistFiredKeys(firedKeys, notifyPersistFailure);
          return;
        }

        const claimed = await claimDueForAnnounce(due);
        if (cancelled) {
          return;
        }
        if (claimed.toAnnounce.length === 0) {
          return;
        }

        await deliverDueReminders({
          items: claimed.toAnnounce,
          channels: reminderChannelDelivery(settings),
          nowMs,
          cancelled: () => cancelled,
          onPersistFailure: notifyPersistFailure,
        });
      } finally {
        runningRef.current = false;
      }
    };

    runScanRef.current = runScan;

    const onSettingsChanged = () => {
      void runScan();
    };

    void (async () => {
      try {
        await Promise.all([
          hydrateNotifySettings(),
          hydrateFiredKeys(),
          hydrateNotifyHistory(),
        ]);
      } catch (error) {
        logWarn("[notify] hydrate failed", error);
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
    window.addEventListener(NOTIFY_SETTINGS_CHANGED_EVENT, onSettingsChanged);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(
        NOTIFY_SETTINGS_CHANGED_EVENT,
        onSettingsChanged,
      );
    };
  }, [toastContext]);

  useEffect(() => {
    if (!worksetsLoading && !tasksLoading && hydratedRef.current) {
      void runScanRef.current();
    }
  }, [worksetsLoading, tasksLoading, worksets, catalogTasks]);
}
