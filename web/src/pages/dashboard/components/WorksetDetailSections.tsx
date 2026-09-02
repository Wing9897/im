import { CalendarDays, Clock, ListChecks, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SectionHeaderIcon } from "../../../components/common/EmptyStateGlyph";
import {
  AccentBarCard,
  Badge,
  CardGrid,
  PanelSection,
  captionClass,
} from "../../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../../components/ui/pageTypography";
import {
  MODE_ACCENT_CLASS,
  MODE_BADGE_TONE,
} from "../../../components/task/analysisModeBadgeTone";
import {
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
} from "../../../components/task/taskFormAnalysisModeMeta";
import type { UserEvent } from "../../../api/userEvents";
import type { TrackableItem } from "../../../api/items";
import type { AnalysisTask } from "../../../types/tasks";
import { formatOsDateTime } from "../../../utils/time";
import { ItemsEntryCard } from "../../../components/items/ItemsEntryCard";

/** Fill the workset dashboard cell; never shrink into a hairline glass bar. */
const WORKSET_PANEL_CLASS = "h-full min-h-fit !shadow-none";
const WORKSET_PANEL_BODY_CLASS = "flex min-h-[7.5rem] flex-1 flex-col";

function WorksetSectionEmpty({ children }: { children: string }) {
  return (
    <div className="flex min-h-[7.5rem] flex-1 items-center">
      <p className={`m-0 ${captionClass}`}>{children}</p>
    </div>
  );
}

export function WorksetExpiringSummarySection({
  loading,
  items,
  itemEmoji,
  onOpenItem,
}: {
  loading: boolean;
  items: TrackableItem[];
  itemEmoji: (item: TrackableItem) => string;
  onOpenItem: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-0" data-testid="workset-summary-expiring">
      <PanelSection
        title={t("workset:detailSummaryExpiringHeading")}
        icon={<SectionHeaderIcon icon={Clock} />}
        showCount={!loading}
        itemCount={items.length}
        aria-label={t("workset:detailSummaryExpiringHeading")}
        className={WORKSET_PANEL_CLASS}
        bodyClassName={WORKSET_PANEL_BODY_CLASS}
      >
        {loading ? (
          <WorksetSectionEmpty>{t("workset:detailSummaryLoading")}</WorksetSectionEmpty>
        ) : items.length === 0 ? (
          <WorksetSectionEmpty>{t("workset:detailSummaryExpiringEmpty")}</WorksetSectionEmpty>
        ) : (
          <CardGrid density="compact">
            {items.map((item) => (
              <ItemsEntryCard
                key={item.id}
                item={item}
                emoji={itemEmoji(item)}
                onOpen={() => onOpenItem(item.id)}
                testId={`workset-summary-item-${item.id}`}
              />
            ))}
          </CardGrid>
        )}
      </PanelSection>
    </div>
  );
}

export function WorksetEventsSummarySection({
  loading,
  error,
  events,
  onOpenEvent,
}: {
  loading: boolean;
  error: string | null;
  events: UserEvent[];
  onOpenEvent: (row: UserEvent) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="h-full min-h-0" data-testid="workset-summary-events">
      <PanelSection
        title={t("workset:detailSummaryEventsHeading")}
        icon={<SectionHeaderIcon icon={CalendarDays} />}
        showCount={!loading}
        itemCount={events.length}
        aria-label={t("workset:detailSummaryEventsHeading")}
        className={WORKSET_PANEL_CLASS}
        bodyClassName={WORKSET_PANEL_BODY_CLASS}
      >
        {loading ? (
          <WorksetSectionEmpty>{t("workset:detailSummaryLoading")}</WorksetSectionEmpty>
        ) : error ? (
          <p className={`m-0 ${captionClass}`} role="status">
            {error}
          </p>
        ) : events.length === 0 ? (
          <WorksetSectionEmpty>{t("workset:detailSummaryEventsEmpty")}</WorksetSectionEmpty>
        ) : (
          <CardGrid density="compact">
            {events.map((row) => (
              <AccentBarCard
                key={row.id}
                accentClass="bg-info"
                material="elevated"
                interactive
                enter="rise"
                data-testid={`workset-summary-event-${row.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpenEvent(row)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenEvent(row);
                  }
                }}
                aria-label={t("workset:openEventAria", { name: row.title })}
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
                    {t("workset:eventAllDay")}
                  </Badge>
                ) : null}
              </AccentBarCard>
            ))}
          </CardGrid>
        )}
      </PanelSection>
    </div>
  );
}

export function WorksetTasksSection({
  tasks,
  onOpenTask,
}: {
  tasks: AnalysisTask[];
  onOpenTask: (task: AnalysisTask) => void;
}) {
  const { t } = useTranslation();
  return (
    <PanelSection
      title={t("workset:detailTasksHeading")}
      icon={<SectionHeaderIcon icon={ListChecks} />}
      showCount
      itemCount={tasks.length}
      aria-label={t("workset:detailTasksHeading")}
      className={WORKSET_PANEL_CLASS}
      bodyClassName={WORKSET_PANEL_BODY_CLASS}
    >
      {tasks.length === 0 ? (
        <WorksetSectionEmpty>{t("workset:detailTasksEmpty")}</WorksetSectionEmpty>
      ) : (
        <CardGrid density="compact">
          {tasks.map((task) => (
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
              aria-label={t("workset:openTaskAria", { name: task.name })}
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
  );
}

export function WorksetItemsSection({
  loading,
  items,
  itemEmoji,
  onOpenItem,
}: {
  loading: boolean;
  items: TrackableItem[];
  itemEmoji: (item: TrackableItem) => string;
  onOpenItem: (itemId: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <PanelSection
      title={t("workset:detailItemsHeading")}
      icon={<SectionHeaderIcon icon={Package} />}
      showCount={!loading}
      itemCount={items.length}
      aria-label={t("workset:detailItemsHeading")}
      className={WORKSET_PANEL_CLASS}
      bodyClassName={WORKSET_PANEL_BODY_CLASS}
    >
      {loading ? (
        <WorksetSectionEmpty>{t("workset:detailSummaryLoading")}</WorksetSectionEmpty>
      ) : items.length === 0 ? (
        <WorksetSectionEmpty>{t("workset:detailItemsEmpty")}</WorksetSectionEmpty>
      ) : (
        <CardGrid density="compact">
          {items.map((item) => (
            <ItemsEntryCard
              key={item.id}
              item={item}
              emoji={itemEmoji(item)}
              onOpen={() => onOpenItem(item.id)}
              testId={`workset-detail-item-${item.id}`}
            />
          ))}
        </CardGrid>
      )}
    </PanelSection>
  );
}
