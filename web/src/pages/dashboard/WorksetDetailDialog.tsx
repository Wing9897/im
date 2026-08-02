/**
 * Light workset detail: glance summary + member analysis tasks + trackable items.
 * Ownership dimension only — not an analysisMode.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ModalDialog";
import {
  AccentBarCard,
  AlertBanner,
  Badge,
  Button,
  FormActions,
  PanelSection,
  captionClass,
} from "../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import { MODE_BADGE_TONE } from "../../components/task/analysisModeBadgeTone";
import { listItems, type TrackableItem } from "../../api/items";
import { listUserEvents, type UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types/tasks";
import type { AnalysisMode } from "../../types/common";
import { formatItemsError } from "../../domain/items/itemErrors";
import { resolveItemEmoji } from "../../domain/items/itemCalendarProjection";
import {
  selectSummaryExpiringItems,
  selectSummaryUserEvents,
  worksetEventsQueryWindow,
} from "../../domain/worksets/worksetDetailSummary";
import { formatOsDateTime } from "../../utils/time";
import { ItemsEntryCard } from "../items/ItemsEntryCard";

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

const MODE_BAR_CLASS: Record<AnalysisMode, string> = {
  leaderboard: "bg-accent",
  event: "bg-info",
  recurring: "bg-success",
  project: "bg-warning",
};

const detailCardGridClass =
  "grid grid-cols-1 gap-card-gap sm:grid-cols-2 [&>*]:min-w-0 [&>*]:h-full";

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

      <div data-testid="workset-summary-expiring">
        <PanelSection
          title={t("workset.detailSummaryExpiringHeading")}
          showCount={!loadingItems}
          itemCount={expiringSummary.length}
          aria-label={t("workset.detailSummaryExpiringHeading")}
          className="!shadow-none"
        >
          {loadingItems ? (
            <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryLoading")}</p>
          ) : expiringSummary.length === 0 ? (
            <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryExpiringEmpty")}</p>
          ) : (
            <div className={detailCardGridClass}>
              {expiringSummary.map((item) => (
                <ItemsEntryCard
                  key={item.id}
                  item={item}
                  emoji={resolveItemEmoji(item, null)}
                  onOpen={() => openItem(item.id)}
                  testId={`workset-summary-item-${item.id}`}
                />
              ))}
            </div>
          )}
        </PanelSection>
      </div>

      <div data-testid="workset-summary-events">
        <PanelSection
          title={t("workset.detailSummaryEventsHeading")}
          showCount={!loadingEvents}
          itemCount={eventsSummary.length}
          aria-label={t("workset.detailSummaryEventsHeading")}
          className="!shadow-none"
        >
          {loadingEvents ? (
            <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryLoading")}</p>
          ) : eventsError ? (
            <p className={`m-0 ${captionClass}`} role="status">
              {eventsError}
            </p>
          ) : eventsSummary.length === 0 ? (
            <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryEventsEmpty")}</p>
          ) : (
            <div className={detailCardGridClass}>
              {eventsSummary.map((row) => (
                <AccentBarCard
                  key={row.id}
                  accentClass="bg-info"
                  material="elevated"
                  interactive
                  enter="rise"
                  data-testid={`workset-summary-event-${row.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEvent(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEvent(row);
                    }
                  }}
                  aria-label={t("workset.openEventAria", { name: row.title })}
                >
                  <span className={`min-w-0 truncate ${cardTitleClass}`} title={row.title}>
                    {row.title}
                  </span>
                  <p className={cardBodyClass}>
                    {formatOsDateTime(row.startTime, {
                      month: "short",
                      day: "numeric",
                      hour: row.isAllDay ? undefined : "2-digit",
                      minute: row.isAllDay ? undefined : "2-digit",
                    })}
                  </p>
                  {row.isAllDay ? (
                    <Badge tone="neutral" className="normal-case tracking-normal w-fit">
                      {t("workset.eventAllDay")}
                    </Badge>
                  ) : null}
                </AccentBarCard>
              ))}
            </div>
          )}
        </PanelSection>
      </div>

      <PanelSection
        title={t("workset.detailTasksHeading")}
        showCount
        itemCount={workset.tasks.length}
        aria-label={t("workset.detailTasksHeading")}
        className="!shadow-none"
      >
        {workset.tasks.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailTasksEmpty")}</p>
        ) : (
          <div className={detailCardGridClass}>
            {workset.tasks.map((task) => (
              <AccentBarCard
                key={task.id}
                accentClass={MODE_BAR_CLASS[task.analysisMode] ?? "bg-accent"}
                material="elevated"
                interactive
                enter="rise"
                data-testid={`workset-detail-task-${task.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenTask(task)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenTask(task);
                  }
                }}
                aria-label={t("workset.openTaskAria", { name: task.name })}
              >
                <div className="flex items-start justify-between gap-sm">
                  <span className={`min-w-0 flex-1 truncate ${cardTitleClass}`} title={task.name}>
                    {task.name}
                  </span>
                  <Badge
                    tone={MODE_BADGE_TONE[task.analysisMode] ?? "neutral"}
                    className="normal-case tracking-normal shrink-0"
                  >
                    {task.analysisMode}
                  </Badge>
                </div>
              </AccentBarCard>
            ))}
          </div>
        )}
      </PanelSection>

      <PanelSection
        title={t("workset.detailItemsHeading")}
        showCount={!loadingItems}
        itemCount={activeItems.length}
        aria-label={t("workset.detailItemsHeading")}
        className="!shadow-none"
      >
        {loadingItems ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailSummaryLoading")}</p>
        ) : activeItems.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailItemsEmpty")}</p>
        ) : (
          <div className={detailCardGridClass}>
            {activeItems.map((item) => (
              <ItemsEntryCard
                key={item.id}
                item={item}
                emoji={resolveItemEmoji(item, null)}
                onOpen={() => openItem(item.id)}
                testId={`workset-detail-item-${item.id}`}
              />
            ))}
          </div>
        )}
      </PanelSection>
    </ModalDialog>
  );
}
