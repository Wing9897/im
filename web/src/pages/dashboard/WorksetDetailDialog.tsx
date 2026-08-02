/**
 * Light workset detail: member analysis tasks + trackable items.
 * Ownership dimension only — not an analysisMode.
 */

import { useEffect, useState } from "react";
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
import type { AnalysisTask } from "../../types/tasks";
import { formatItemsError } from "../../domain/items/itemErrors";
import { daysUntil } from "../../domain/items/itemAttributes";

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
  const [loadingItems, setLoadingItems] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingItems(true);
    setError(null);
    void listItems({ worksetId: workset.id })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(formatItemsError(err, tItems));
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

  const activeItems = items.filter((row) => row.status !== "archived");

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

      {error ? (
        <AlertBanner variant="error" role="alert" className="mb-0">
          {error}
        </AlertBanner>
      ) : null}

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
          <p className={`m-0 ${captionClass}`}>…</p>
        ) : activeItems.length === 0 ? (
          <p className={`m-0 ${captionClass}`}>{t("workset.detailItemsEmpty")}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {activeItems.map((item) => {
              const days = daysUntil(item.expiresAt);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-sm rounded-lg border border-surface-border/70 px-sm py-xs"
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
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </ModalDialog>
  );
}
