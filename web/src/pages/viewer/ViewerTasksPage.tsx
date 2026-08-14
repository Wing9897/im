/**
 * Viewer Tasks Page — displays the task list using GET /api/v1/viewer/tasks.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchViewerTasks } from "../../api/viewer";
import type { ViewerTask } from "../../types";
import { Badge, SurfaceCard } from "../../components/ui";
import { MasterDetailSplit, useDetailSelection } from "../../components/detail";
import { useDetailPresentation } from "../../hooks/useDetailPresentation";
import { useListKeyboardNavigation } from "../../hooks/useListKeyboardNavigation";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useViewerResource } from "./useViewerResource";
import { ViewerShell } from "../../components/ui/ViewerShell";
import { ViewerTaskDetailView } from "./ViewerTaskDetailView";
import { formatOsDateTime } from "../../utils/time";
import { VIEWER_TASKS_SELECTED_ID_STORAGE_KEY } from "../../domain/prefs";

export function ViewerTasksPage() {
  const { t } = useTranslation("common");
  const { data: tasks, initialLoading, isRefreshing, error, retry } = useViewerResource<ViewerTask[]>(
    fetchViewerTasks,
    t("viewer:tasksLoadError"),
  );

  const taskList = useMemo(() => tasks ?? [], [tasks]);
  const presentation = useDetailPresentation();
  const { selected, select, clear } = useDetailSelection<ViewerTask>();
  const [persistedTaskId, setPersistedTaskId] = usePersistedState<string | null>(
    VIEWER_TASKS_SELECTED_ID_STORAGE_KEY,
    null,
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const selectTask = useCallback(
    (task: ViewerTask) => {
      setPersistedTaskId(task.id);
      setFocusedId(task.id);
      select(task);
    },
    [select, setPersistedTaskId],
  );

  const clearTaskSelection = useCallback(() => {
    setPersistedTaskId(null);
    setFocusedId(null);
    clear();
  }, [clear, setPersistedTaskId]);

  useEffect(() => {
    if (initialLoading || selected || !persistedTaskId) {
      return;
    }
    const task = taskList.find((item) => item.id === persistedTaskId);
    if (task) {
      setFocusedId(task.id);
      select(task);
    }
  }, [initialLoading, persistedTaskId, select, selected, taskList]);

  useListKeyboardNavigation({
    items: taskList,
    selectedId: focusedId ?? selected?.id ?? null,
    getItemId: (task) => task.id,
    onSelect: (task) => setFocusedId(task.id),
    onActivate: selectTask,
    onEscape: clearTaskSelection,
    enabled: !initialLoading && taskList.length > 0,
  });

  const detailView = selected ? (
    <ViewerTaskDetailView
      task={selected}
      onClose={clearTaskSelection}
      presentation={presentation}
    />
  ) : null;

  const list = taskList.length === 0 ? (
    <p className="py-3xl text-center text-body text-text-subtle">{t("viewer:tasksEmpty")}</p>
  ) : (
    <div className="flex flex-col gap-md">
      {taskList.map((task) => {
        const isSelected = focusedId === task.id || selected?.id === task.id;
        return (
          <SurfaceCard
            key={task.id}
            density="field"
            interactive
            className={[
              "flex cursor-pointer flex-col gap-sm",
              isSelected
                ? "border-[color-mix(in_srgb,var(--accent)_40%,var(--surface-border))] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => {
              selectTask(task);
            }}
            role="button"
            tabIndex={0}
            aria-label={t("viewer:viewTaskAria", { name: task.name })}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectTask(task);
              }
            }}
          >
            <div className="flex items-center justify-between gap-sm">
              <span className="text-body font-semibold text-text-primary">{task.name}</span>
              <Badge tone={task.isActive ? "success" : "neutral"}>
                {task.isActive ? t("viewer:active") : t("viewer:inactive")}
              </Badge>
            </div>
            <div className="text-caption text-text-muted">
              {t("viewer:lastAnalysis")}
              {task.lastAnalysisAt
                ? formatOsDateTime(task.lastAnalysisAt)
                : t("viewer:neverRun")}
            </div>
          </SurfaceCard>
        );
      })}
    </div>
  );

  return (
    <ViewerShell
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
      error={error}
      retry={retry}
      refreshLabel={t("viewer:tasksRefreshing")}
    >
      <MasterDetailSplit
        split={presentation === "inline" && selected != null}
        list={list}
        detail={presentation === "inline" ? detailView : null}
      />
      {presentation === "drawer" ? detailView : null}
    </ViewerShell>
  );
}
