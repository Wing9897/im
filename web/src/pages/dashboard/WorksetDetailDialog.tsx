/**
 * Light workset detail: glance summary + member analysis tasks + trackable items.
 * Ownership dimension only — not an analysisMode.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ModalDialog";
import {
  AlertBanner,
  Badge,
  Button,
  FormActions,
  captionClass,
  sectionTitleClass,
} from "../../components/ui";
import { listItems, type TrackableItem } from "../../api/items";
import { listUserEvents, type UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types/tasks";
import { formatItemsError } from "../../domain/items/itemErrors";
import { daysUntil } from "../../domain/items/itemAttributes";
import {
  selectSummaryExpiringItems,
  selectSummaryUserEvents,
  worksetEventsQueryWindow,
} from "../../domain/worksets/worksetDetailSummary";
import { formatOsDateTime } from "../../utils/time";

export type WorksetDetailTarget = {
  id: string;
  title: string;
  isSystem: boolean;
  tasks: AnalysisTask[];
};

type Props = {
  workset: WorksetDetailTarget;
  onClose: () => void;
  onOpenTask: (task: AnalysisTask) => void;
  onRename?: () => void;
  onDelete?: () => void;
};

export function WorksetDetailDialog({
  workset,
  onClose,
  onOpenTask,
  onRename,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { t: tItems } = useTranslation("items");
  const navigate = useNavigate();
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [eventsError, setEventsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingItems(true);
    setItemsError(null);
    void listItems({ worksetId: workset.id })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err) => {
        if (!cancelled) setItemsError(formatItemsError(err, tItems));
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
    // tItems is stable under real i18n; omit to avoid mock/re-render loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workset.id is the load key
  }, [workset.id]);

  useEffect(() => {
    let cancelled = false;
    setLoadingEvents(true);
    setEventsError(null);
    const { start, end } = worksetEventsQueryWindow();
    void listUserEvents({ worksetId: workset.id, start, end })
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setEventsError(t("workset.detailSummaryEventsError"));
      })
      .finally(() => {
        if (!cancelled) setLoadingEvents(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- workset.id is the load key
  }, [workset.id]);

  const activeItems = items.filter((row) => row.status !== "archived");
  const expiringSummary = useMemo(() => selectSummaryExpiringItems(items), [items]);
  const eventsSummary = useMemo(() => selectSummaryUserEvents(events), [events]);

  const goCreateItem = () => {
    onClose();
    navigate(`/items?new=1&worksetId=${encodeURIComponent(workset.id)}`);
  };

  const goCreateEvent = () => {
    onClose();
    navigate(`/timeline?newEvent=1&worksetId=${encodeURIComponent(workset.id)}`);
  };

  const openItem = (itemId: string) => {
    onClose();
    navigate(`/items?itemId=${encodeURIComponent(itemId)}`);
  };

  const openEvent = (row: UserEvent) => {
    onClose();
    const params = new URLSearchParams({
      eventId: row.id,
      at: row.startTime,
    });
    navigate(`/timeline?${params.toString()}`);
  };

  return (
    <ModalDialog
      open
      size="form"
      title={t("workset.detailTitle", { name: workset.title })}
      onClose={onClose}
      testId="workset-detail-dialog"
      bodyClassName="flex flex-col gap-md"
      footer={
        <FormActions inline>
          {!workset.isSystem && onRename ? (
            <Button variant="secondary" size="sm" onClick={onRename}>
              {t("workset.rename")}
            </Button>
          ) : null}
          {!workset.isSystem && onDelete ? (
            <Button variant="secondary" size="sm" onClick={onDelete}>
              {t("workset.delete")}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            onClick={goCreateItem}
            data-testid="workset-detail-add-item"
          >
            {t("workset.addItem")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={goCreateEvent}
            data-testid="workset-detail-add-event"
          >
            {t("workset.addEvent")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClose();
              navigate("/items");
            }}
          >
            {t("workset.openItems")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onClose();
              navigate("/tasks/new");
            }}
          >
            {t("tasks.addTask")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("dialog.close")}
          </Button>
        </FormActions>
      }
    >
      <p className={`m-0 ${captionClass}`}>{t("workset.detailSubtitle")}</p>

      {itemsError ? (
        <AlertBanner variant="error" role="alert" className="mb-0">
          {itemsError}
        </AlertBanner>
      ) : null}

      <section aria-label={t("workset.detailSummaryExpiringHeading")} data-testid="workset-summary-expiring">
        <h3 className={`${sectionTitleClass} mb-sm`}>
          {t("workset.detailSummaryExpiringHeading")}
          <span className={`ml-xs font-normal ${captionClass}`}>
            ({loadingItems ? "…" : expiringSummary.length})
          </span>
        </h3>
        {loadingItems ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryLoading")}</p>
        ) : expiringSummary.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryExpiringEmpty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {expiringSummary.map((item) => {
              const days = daysUntil(item.expiresAt);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-sm rounded-lg border border-surface-border/70 bg-transparent px-sm py-xs text-left hover:border-accent/50"
                    onClick={() => openItem(item.id)}
                    data-testid={`workset-summary-item-${item.id}`}
                  >
                    <span className="min-w-0 truncate text-body text-text-primary">
                      {item.title}
                    </span>
                    <span className={`shrink-0 ${captionClass}`}>
                      {item.expiresAt
                        ? days != null && days < 0
                          ? t("workset.itemOverdue", { count: Math.abs(days) })
                          : item.expiresAt
                        : t("workset.itemNoExpiry")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label={t("workset.detailSummaryEventsHeading")} data-testid="workset-summary-events">
        <h3 className={`${sectionTitleClass} mb-sm`}>
          {t("workset.detailSummaryEventsHeading")}
          <span className={`ml-xs font-normal ${captionClass}`}>
            ({loadingEvents ? "…" : eventsSummary.length})
          </span>
        </h3>
        {loadingEvents ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryLoading")}</p>
        ) : eventsError ? (
          <p className={`m-0 ${captionClass}`} role="status">
            {eventsError}
          </p>
        ) : eventsSummary.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryEventsEmpty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {eventsSummary.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-sm rounded-lg border border-surface-border/70 bg-transparent px-sm py-xs text-left hover:border-accent/50"
                  onClick={() => openEvent(row)}
                  data-testid={`workset-summary-event-${row.id}`}
                >
                  <span className="min-w-0 truncate text-body text-text-primary">
                    {row.title}
                  </span>
                  <span className={`shrink-0 ${captionClass}`}>
                    {formatOsDateTime(row.startTime, {
                      month: "short",
                      day: "numeric",
                      hour: row.isAllDay ? undefined : "2-digit",
                      minute: row.isAllDay ? undefined : "2-digit",
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t("workset.detailTasksHeading")}>
        <h3 className={`${sectionTitleClass} mb-sm`}>
          {t("workset.detailTasksHeading")}
          <span className={`ml-xs font-normal ${captionClass}`}>
            ({workset.tasks.length})
          </span>
        </h3>
        {workset.tasks.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailTasksEmpty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {workset.tasks.map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-sm rounded-lg border border-surface-border/70 bg-transparent px-sm py-xs text-left hover:border-accent/50"
                  onClick={() => onOpenTask(task)}
                  data-testid={`workset-detail-task-${task.id}`}
                >
                  <span className="min-w-0 truncate text-body text-text-primary">
                    {task.name}
                  </span>
                  <Badge tone="neutral" className="normal-case tracking-normal shrink-0">
                    {task.analysisMode}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t("workset.detailItemsHeading")}>
        <h3 className={`${sectionTitleClass} mb-sm`}>
          {t("workset.detailItemsHeading")}
          <span className={`ml-xs font-normal ${captionClass}`}>
            ({loadingItems ? "…" : activeItems.length})
          </span>
        </h3>
        {loadingItems ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryLoading")}</p>
        ) : activeItems.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailItemsEmpty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {activeItems.map((item) => {
              const days = daysUntil(item.expiresAt);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-sm rounded-lg border border-surface-border/70 bg-transparent px-sm py-xs text-left hover:border-accent/50"
                    onClick={() => openItem(item.id)}
                    data-testid={`workset-detail-item-${item.id}`}
                  >
                    <span className="min-w-0 truncate text-body text-text-primary">
                      {item.title}
                    </span>
                    <span className={`shrink-0 ${captionClass}`}>
                      {item.expiresAt
                        ? days != null && days < 0
                          ? t("workset.itemOverdue", { count: Math.abs(days) })
                          : item.expiresAt
                        : t("workset.itemNoExpiry")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </ModalDialog>
  );
}
