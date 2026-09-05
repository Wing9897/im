import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertBanner, Button, FormActions, captionClass } from "../../components/ui";
import type { UserEvent } from "../../api/userEvents";
import type { AnalysisTask } from "../../types/tasks";
import { isAgentCalendarTask } from "../../domain/tasks/isAgentCalendarTask";
import { useWorksetDetailData } from "../../components/worksets/useWorksetDetailData";
import {
  WorksetEventsSummarySection,
  WorksetExpiringSummarySection,
  WorksetItemsSection,
  WorksetTasksSection,
} from "../../components/worksets/WorksetDetailSections";

export type WorksetWorkspaceTarget = {
  id: string;
  title: string;
  isSystem: boolean;
  tasks: AnalysisTask[];
};

type Props = {
  workset: WorksetWorkspaceTarget;
};

/** Workset contents: task / item / calendar lists. */
export function WorksetContentsPanel({ workset }: Props) {
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
    navigate(`/items/new?worksetId=${encodeURIComponent(workset.id)}`);
  };

  const goCreateEvent = () => {
    navigate(`/timeline?newEvent=1&worksetId=${encodeURIComponent(workset.id)}`);
  };

  const openItem = (itemId: string) => {
    navigate(`/items/${encodeURIComponent(itemId)}/edit`);
  };

  const openEvent = (row: UserEvent) => {
    const params = new URLSearchParams({
      eventId: row.id,
      at: row.startTime,
    });
    navigate(`/timeline?${params.toString()}`);
  };

  const openTask = (task: AnalysisTask) => {
    if (isAgentCalendarTask(task)) {
      navigate(`/tasks/${encodeURIComponent(task.id)}/agent`);
      return;
    }
    navigate(`/tasks/${encodeURIComponent(task.id)}/edit`);
  };

  return (
    <div
      className="flex w-full min-w-0 shrink-0 flex-col justify-start gap-md"
      data-testid="workset-contents-panel"
    >
      <p className={`m-0 ${captionClass}`}>{t("workset:detailSubtitle")}</p>

      {itemsError ? (
        <AlertBanner variant="error" role="alert" className="mb-0">
          {itemsError}
        </AlertBanner>
      ) : null}

      <div
        className="grid w-full min-w-0 grid-cols-1 items-stretch gap-md lg:grid-cols-2"
        data-testid="workset-contents-grid"
      >
        <WorksetExpiringSummarySection
          loading={loadingItems}
          items={expiringSummary}
          itemEmoji={itemEmoji}
          onOpenItem={openItem}
        />

        <WorksetEventsSummarySection
          loading={loadingEvents}
          error={eventsError}
          events={eventsSummary}
          onOpenEvent={openEvent}
        />

        <WorksetTasksSection tasks={workset.tasks} onOpenTask={openTask} />

        <WorksetItemsSection
          loading={loadingItems}
          items={activeItems}
          itemEmoji={itemEmoji}
          onOpenItem={openItem}
        />
      </div>

      <FormActions inline className="shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={goCreateItem}
          data-testid="workset-detail-add-item"
        >
          {t("workset:addItem")}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={goCreateEvent}
          data-testid="workset-detail-add-event"
        >
          {t("workset:addEvent")}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate("/items")}>
          {t("workset:openItems")}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(`/tasks/new?worksetId=${encodeURIComponent(workset.id)}`)}
          data-testid="workset-detail-add-task"
        >
          {t("tasks:addTask")}
        </Button>
      </FormActions>
    </div>
  );
}
