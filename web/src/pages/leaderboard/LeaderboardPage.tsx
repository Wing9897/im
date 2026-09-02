import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/common/EmptyState";
import { ErrorRetryBanner } from "../../components/common/ErrorRetryBanner";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { AppPageShell, Button, EmptyStateLink, MenuSelect, OpsControlBar } from "../../components/ui";
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

  const emptyVariant =
    leaderboardTasks.length === 0 ? "noTasks" : selectedTaskId ? "filtered" : "noResults";

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
          ariaLabel={t("leaderboard:toolbarAria")}
          data-testid="leaderboard-toolbar"
        >
          {leaderboardTasks.length > 0 ? (
            <MenuSelect
              variant="toolbar"
              menuPortal
              value={selectedTaskId}
              options={[
                { value: "", label: t("leaderboard:allBoards") },
                ...leaderboardTasks.map((task) => ({
                  value: task.id,
                  label: task.name,
                })),
              ]}
              onChange={setSelectedTaskId}
              aria-label={t("leaderboard:selectTaskAria")}
              data-testid="leaderboard-task-select"
              className="max-w-[200px]"
              triggerClassName={`${pageOpsControlClass} max-w-[200px] w-auto px-2`}
            />
          ) : null}
          {isRefreshing ? <RefreshIndicator label={t("leaderboard:refreshing")} /> : null}
        </OpsControlBar>
      ) : null}

      {initialLoading ? (
        <SkeletonScreen variant="table-rows" count={3} />
      ) : topics.length === 0 ? (
        <EmptyState
          title={t(`leaderboard:empty.${emptyVariant}.title`)}
          description={t(`leaderboard:empty.${emptyVariant}.description`)}
          hint={t(`leaderboard:empty.${emptyVariant}.hint`)}
          actions={
            leaderboardTasks.length === 0 ? (
              <EmptyStateLink to="/worksets?tab=tasks">{t("leaderboard:goToTasks")}</EmptyStateLink>
            ) : selectedTaskId ? (
              <Button
                variant="secondary"
                onClick={resetTaskFilter}
                aria-label={t("leaderboard:viewAllAria")}
              >
                {t("leaderboard:viewAll")}
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
