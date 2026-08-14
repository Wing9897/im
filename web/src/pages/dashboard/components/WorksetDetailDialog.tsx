/**
 * Light workset detail: glance summary + member analysis tasks + trackable items.
 * Ownership dimension only — not an analysisMode.
 */

import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../../../components/ModalDialog";
import {
  AlertBanner,
  Button,
  FormActions,
  captionClass,
} from "../../../components/ui";
import type { UserEvent } from "../../../api/userEvents";
import type { AnalysisTask } from "../../../types/tasks";
import { useWorksetDetailData } from "../hooks/useWorksetDetailData";
import {
  WorksetEventsSummarySection,
  WorksetExpiringSummarySection,
  WorksetItemsSection,
  WorksetTasksSection,
} from "./WorksetDetailSections";

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
    navigate(`/items/new?worksetId=${encodeURIComponent(workset.id)}`);
  };

  const goCreateEvent = () => {
    onClose();
    navigate(`/timeline?newEvent=1&worksetId=${encodeURIComponent(workset.id)}`);
  };

  const openItem = (itemId: string) => {
    onClose();
    navigate(`/items/${encodeURIComponent(itemId)}/edit`);
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
      title={t("workset:detailTitle", { name: workset.title })}
      onClose={onClose}
      testId="workset-detail-dialog"
      bodyClassName="flex flex-col gap-md"
      footer={
        <FormActions inline>
          {!workset.isSystem && onRename ? (
            <Button variant="secondary" size="sm" onClick={onRename}>
              {t("workset:rename")}
            </Button>
          ) : null}
          {!workset.isSystem && onDelete ? (
            <Button variant="secondary" size="sm" onClick={onDelete}>
              {t("workset:delete")}
            </Button>
          ) : null}
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              onClose();
              navigate("/items");
            }}
          >
            {t("workset:openItems")}
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
            {t("tasks:addTask")}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t("dialog.close")}
          </Button>
        </FormActions>
      }
    >
      <p className={`m-0 ${captionClass}`}>{t("workset:detailSubtitle")}</p>

      {itemsError ? (
        <AlertBanner variant="error" role="alert" className="mb-0">
          {itemsError}
        </AlertBanner>
      ) : null}

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

      <WorksetTasksSection tasks={workset.tasks} onOpenTask={onOpenTask} />

      <WorksetItemsSection
        loading={loadingItems}
        items={activeItems}
        itemEmoji={itemEmoji}
        onOpenItem={openItem}
      />
    </ModalDialog>
  );
}
