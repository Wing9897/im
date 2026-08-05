/**
 * Light workset detail: glance summary + member analysis tasks + trackable items.
 * Ownership dimension only — not an analysisMode.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../components/ModalDialog";
import {
  AccentBarCard,
  AlertBanner,
  Badge,
  Button,
  CardGrid,
  FormActions,
  PanelSection,
  captionClass,
} from "../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import {
  MODE_ACCENT_CLASS,
  MODE_BADGE_TONE,
} from "../../components/task/analysisModeBadgeTone";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "../../components/task/taskFormAnalysisModeMeta";
import type { UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types/tasks";
import { formatOsDateTime } from "../../utils/time";
import { ItemsEntryCard } from "../items/ItemsEntryCard";
import { useWorksetDetailData } from "./useWorksetDetailData";

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
  const navigate = useNavigate();
  const {
    loadingItems,
    loadingEvents,
    itemsError,
    eventsError,
    activeItems,
    expiringSummary,
    eventsSummary,
    itemEmoji,
  } = useWorksetDetailData(workset.id);

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
              navigate(`/tasks/new?worksetId=${encodeURIComponent(workset.id)}`);
            }}
            data-testid="workset-detail-add-task"
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
            <CardGrid density="compact">
              {expiringSummary.map((item) => (
                <ItemsEntryCard
                  key={item.id}
                  item={item}
                  emoji={itemEmoji(item)}
                  onOpen={() => openItem(item.id)}
                  testId={`workset-summary-item-${item.id}`}
                />
              ))}
            </CardGrid>
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
            <CardGrid density="compact">
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
            </CardGrid>
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
          <CardGrid density="compact">
            {workset.tasks.map((task) => (
              <AccentBarCard
                key={task.id}
                accentClass={MODE_ACCENT_CLASS[task.analysisMode] ?? "bg-accent"}
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
                    {getTaskEmployeeDisplayName(getTaskEmployeeIdForMode(task.analysisMode))}
                  </Badge>
                </div>
              </AccentBarCard>
            ))}
          </CardGrid>
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
          <CardGrid density="compact">
            {activeItems.map((item) => (
              <ItemsEntryCard
                key={item.id}
                item={item}
                emoji={itemEmoji(item)}
                onOpen={() => openItem(item.id)}
                testId={`workset-detail-item-${item.id}`}
              />
            ))}
          </CardGrid>
        )}
      </PanelSection>
    </ModalDialog>
  );
}
