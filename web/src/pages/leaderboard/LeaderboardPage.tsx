import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorRetryBanner } from "../../components/common/ErrorRetryBanner";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { AppPageShell, Button, EmptyStateLink, OpsControlBar, SelectField } from "../../components/ui";
import { pageOpsControlClass } from "../../components/ui/controlStyles";
import { RefreshIndicator } from "../../components/common/RefreshIndicator";
import { LeaderboardTaskTable } from "./LeaderboardTaskTable";
import { useLeaderboardPage } from "./useLeaderboardPage";

export function LeaderboardPage() {
  const { t } = useTranslation("common");
  const [isRetrying, setIsRetrying] = useState(false);
  const {
    topics,
    initialLoading,
    isRefreshing,
    pageError,
    expandedTopicId,
    topicMessages,
    loadingMessages,
    topicMessageErrors,
    selectedTaskId,
    setSelectedTaskId,
    leaderboardTasks,
    resetTaskFilter,
    handleToggleTopic,
    refreshTopics,
    taskPlatformMap,
    groupedBoards,
  } = useLeaderboardPage();

  return (
    <AppPageShell>
      {pageError ? (
        <ErrorRetryBanner
          error={pageError}
          retrying={isRetrying}
          onRetry={() => {
            setIsRetrying(true);
            void refreshTopics().finally(() => setIsRetrying(false));
          }}
        />
      ) : null}

      {leaderboardTasks.length > 0 || isRefreshing ? (
        <OpsControlBar
          sticky
          ariaLabel={t("leaderboard.toolbarAria")}
          data-testid="leaderboard-toolbar"
        >
          {leaderboardTasks.length > 0 ? (
            <SelectField
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              aria-label={t("leaderboard.selectTaskAria")}
              className={`${pageOpsControlClass} max-w-[200px] w-auto px-2`}
            >
              <option value="">{t("leaderboard.allBoards")}</option>
              {leaderboardTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </SelectField>
          ) : null}
          {isRefreshing ? <RefreshIndicator label={t("leaderboard.refreshing")} /> : null}
        </OpsControlBar>
      ) : null}

      {initialLoading ? (
        <SkeletonScreen variant="table-rows" count={3} />
      ) : topics.length === 0 ? (
        <EmptyState
          title={
            leaderboardTasks.length === 0
              ? t("leaderboard.emptyNoTasksTitle")
              : selectedTaskId
                ? t("leaderboard.emptyFilteredTitle")
                : t("leaderboard.emptyNoResultsTitle")
          }
          description={
            leaderboardTasks.length === 0
              ? t("leaderboard.emptyNoTasksDescription")
              : selectedTaskId
                ? t("leaderboard.emptyFilteredDescription")
                : t("leaderboard.emptyNoResultsDescription")
          }
          hint={
            leaderboardTasks.length === 0
              ? t("leaderboard.emptyNoTasksHint")
              : selectedTaskId
                ? t("leaderboard.emptyFilteredHint")
                : t("leaderboard.emptyNoResultsHint")
          }
          actions={
            leaderboardTasks.length === 0 ? (
              <EmptyStateLink to="/tasks">{t("leaderboard.goToTasks")}</EmptyStateLink>
            ) : selectedTaskId ? (
              <Button
                variant="secondary"
                onClick={resetTaskFilter}
                aria-label={t("leaderboard.viewAllAria")}
              >
                {t("leaderboard.viewAll")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="im-board-grid">
          {groupedBoards.map((board) => (
            <LeaderboardTaskTable
              key={board.taskId}
              taskName={board.taskName}
              topics={board.topics}
              expandedTopicId={expandedTopicId}
              topicMessages={topicMessages}
              loadingMessages={loadingMessages}
              topicMessageErrors={topicMessageErrors}
              onToggleTopic={(topicId) => { void handleToggleTopic(topicId); }}
              platforms={
                board.taskId !== "unknown"
                  ? taskPlatformMap.get(board.taskId)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </AppPageShell>
  );
}
