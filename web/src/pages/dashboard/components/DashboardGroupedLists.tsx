/**
 * DashboardViewer task list rendering — flat grid ("by_task") and
 * workset-grouped sections ("by_workset").
 */

import type { CSSProperties } from "react";
import type { TFunction } from "i18next";
import type { NavigateFunction } from "react-router-dom";
import { Plus } from "lucide-react";
import { CreateCard, sectionTitleClass, captionClass } from "../../../components/ui";
import { TaskCard } from "../../../components/TaskCard";
import { TaskGrid } from "../../../components/TaskGrid";
import { WorksetSummaryCard } from "../../../components/WorksetSummaryCard";
import type { AnalysisTask } from "../../../types/tasks";
import type { TaskCardStats } from "../../../types/dashboard";

interface TaskListActions {
  statsMap: Map<string, TaskCardStats>;
  defaultStats: TaskCardStats;
  focusedId: string | null;
  detailTaskId: string | null;
  onToggleActive: (taskId: string) => Promise<void>;
  onEdit: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onOpenTask: (task: AnalysisTask) => void;
}

function TaskCardTile({
  task,
  index,
  statsMap,
  defaultStats,
  focusedId,
  detailTaskId,
  onToggleActive,
  onEdit,
  onDelete,
  onOpenTask,
}: TaskListActions & { task: AnalysisTask; index: number }) {
  return (
    <div className="im-enter-rise" style={{ "--i": Math.min(index, 8) } as CSSProperties}>
      <TaskCard
        task={task}
        stats={statsMap.get(task.id) ?? defaultStats}
        isSelected={focusedId === task.id || detailTaskId === task.id}
        onToggleActive={onToggleActive}
        onEdit={onEdit}
        onDelete={onDelete}
        onSelect={() => onOpenTask(task)}
      />
    </div>
  );
}

interface CreateTaskTileProps {
  navigate: NavigateFunction;
  t: TFunction;
  createLabel: string;
  style?: CSSProperties;
}

function CreateTaskTile({ navigate, t, createLabel, style }: CreateTaskTileProps) {
  return (
    <CreateCard
      className="im-enter-rise"
      style={style}
      onClick={() => navigate("/tasks/new")}
      aria-label={t("tasks.createNewAria", { label: createLabel })}
      icon={<Plus size={16} aria-hidden="true" />}
      label={t("tasks.createNew")}
    />
  );
}

function CreateWorksetTile({
  t,
  onCreateWorkset,
  style,
}: {
  t: TFunction;
  onCreateWorkset: () => void;
  style?: CSSProperties;
}) {
  return (
    <CreateCard
      className="im-enter-rise"
      style={style}
      onClick={onCreateWorkset}
      aria-label={t("workset.createNewAria")}
      icon={<Plus size={16} aria-hidden="true" />}
      label={t("workset.createNew")}
      data-testid="dashboard-create-workset-card"
    />
  );
}

/** Flat grid of visible tasks ("by_task" grouping view), with the trailing create tile. */
export function DashboardByTaskList({
  tasks,
  navigate,
  t,
  createLabel,
  ...actions
}: TaskListActions & {
  tasks: AnalysisTask[];
  navigate: NavigateFunction;
  t: TFunction;
  createLabel: string;
}) {
  return (
    <TaskGrid>
      {tasks.map((task, index) => (
        <TaskCardTile key={task.id} task={task} index={index} {...actions} />
      ))}
      <CreateTaskTile
        navigate={navigate}
        t={t}
        createLabel={createLabel}
        style={{ "--i": Math.min(tasks.length, 8) } as CSSProperties}
      />
    </TaskGrid>
  );
}

export interface DashboardWorksetGroup {
  key: string;
  title: string;
  isSystem: boolean;
  tasks: AnalysisTask[];
}

/**
 * Workset-first layout: each ownership workset (incl. builtin「一般」) is a card;
 * analysis tasks belonging to that workset appear underneath. No system-task cards.
 */
export function DashboardByWorksetList({
  groups,
  t,
  itemCountByWorkset,
  onOpenWorkset,
  onRenameWorkset,
  onDeleteWorkset,
  onCreateWorkset,
  ...actions
}: TaskListActions & {
  groups: DashboardWorksetGroup[];
  t: TFunction;
  itemCountByWorkset?: Map<string, number>;
  onOpenWorkset: (id: string) => void;
  onRenameWorkset: (id: string, name: string) => void;
  onDeleteWorkset: (id: string, name: string) => void;
  onCreateWorkset: () => void;
}) {
  const worksetCards = groups.filter((group) => group.key !== "__unassigned__");
  const unassigned = groups.find((group) => group.key === "__unassigned__");

  return (
    <div className="flex flex-col gap-lg" data-testid="dashboard-by-workset">
      <section aria-label={t("workset.viewByWorkset")}>
        <h2 className={`${sectionTitleClass} mb-sm`}>{t("workset.catalogTitle")}</h2>
        <p className={`${captionClass} mb-md`}>{t("workset.catalogSubtitle")}</p>
        <TaskGrid>
          {worksetCards.map((group) => (
            <WorksetSummaryCard
              key={group.key}
              id={group.key}
              title={group.title}
              isSystem={group.isSystem}
              taskCount={group.tasks.length}
              itemCount={itemCountByWorkset?.get(group.key) ?? 0}
              onOpen={() => onOpenWorkset(group.key)}
              onRename={
                group.isSystem
                  ? undefined
                  : () => onRenameWorkset(group.key, group.title)
              }
              onDelete={
                group.isSystem
                  ? undefined
                  : () => onDeleteWorkset(group.key, group.title)
              }
            />
          ))}
          <CreateWorksetTile t={t} onCreateWorkset={onCreateWorkset} />
        </TaskGrid>
      </section>

      {worksetCards.map((group) =>
        group.tasks.length > 0 ? (
          <section key={`tasks-${group.key}`} aria-label={group.title}>
            <h2 className={`${sectionTitleClass} mb-sm`}>
              {t("workset.memberTasksTitle", { name: group.title })}
            </h2>
            <TaskGrid>
              {group.tasks.map((task, index) => (
                <TaskCardTile key={task.id} task={task} index={index} {...actions} />
              ))}
            </TaskGrid>
          </section>
        ) : null,
      )}

      {unassigned && unassigned.tasks.length > 0 ? (
        <section aria-label={unassigned.title}>
          <h2 className={`${sectionTitleClass} mb-sm`}>{unassigned.title}</h2>
          <p className={`${captionClass} mb-md`}>{t("workset.unassignedHint")}</p>
          <TaskGrid>
            {unassigned.tasks.map((task, index) => (
              <TaskCardTile key={task.id} task={task} index={index} {...actions} />
            ))}
          </TaskGrid>
        </section>
      ) : null}
    </div>
  );
}
