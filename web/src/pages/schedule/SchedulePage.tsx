/**
 * Manage-area schedule page: one-off user events + recurring calendar tasks.
 */

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { listItems } from "../../api/items";
import { UserEventDialog } from "../../components/calendar/UserEventDialog";
import { EmptyState } from "../../components/common/EmptyState";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  AppPageShell,
  Button,
  CardGrid,
  LoadMoreFooter,
} from "../../components/ui";
import {
  SCHEDULE_SEARCH_STORAGE_KEY,
  SCHEDULE_TAB_STORAGE_KEY,
} from "../../domain/prefs";
import { useErrorToast } from "../../hooks/useErrorToast";
import { usePersistedEnum, usePersistedState } from "../../hooks/usePersistedState";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { ScheduleOneOffCard, ScheduleRecurringCard } from "./ScheduleEventCard";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { isScheduleTab, type ScheduleTab } from "./scheduleConfig";
import { useScheduleOneOffFeed } from "./useScheduleOneOffFeed";
import { useSchedulePageDialogs } from "./useSchedulePageDialogs";
import { useScheduleRecurringFeed } from "./useScheduleRecurringFeed";

export function SchedulePage() {
  const { t } = useTranslation("schedule");
  const { t: tCommon } = useTranslation("common");
  const [tab, setTab] = usePersistedEnum<ScheduleTab>(
    SCHEDULE_TAB_STORAGE_KEY,
    "oneOff",
    isScheduleTab,
  );
  const [searchQuery, setSearchQuery] = usePersistedState(SCHEDULE_SEARCH_STORAGE_KEY, "", {
    persistDebounceMs: 400,
    storage: "session",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [itemTitleById, setItemTitleById] = useState<Map<string, string>>(new Map());

  useSlashFocusSearch(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    void listItems({ status: "active" })
      .then((items) => {
        if (cancelled) return;
        setItemTitleById(
          new Map(
            items.map((item) => [
              item.id,
              item.emoji ? `${item.emoji} ${item.title}` : item.title,
            ]),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setItemTitleById(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const oneOff = useScheduleOneOffFeed({
    enabled: tab === "oneOff",
    debouncedSearch,
  });
  const recurring = useScheduleRecurringFeed({
    enabled: tab === "recurring",
    debouncedSearch,
  });

  const dialogs = useSchedulePageDialogs({
    tab,
    reloadOneOff: oneOff.reload,
    reloadRecurring: recurring.reload,
  });

  const feedError = tab === "oneOff" ? oneOff.error : recurring.error;
  useErrorToast(feedError);

  const loading =
    tab === "oneOff"
      ? oneOff.initialLoading && oneOff.items.length === 0
      : recurring.initialLoading && recurring.items.length === 0;

  const itemsEmpty =
    tab === "oneOff" ? oneOff.items.length === 0 : recurring.items.length === 0;

  const loadMoreHint = useMemo(() => {
    if (tab === "oneOff") {
      return oneOff.hasMore
        ? t("loadMoreHintHasMore", { shown: oneOff.items.length })
        : t("loadMoreHint", { shown: oneOff.items.length, total: oneOff.totalCount });
    }
    return recurring.hasMore
      ? t("loadMoreHintHasMore", { shown: recurring.items.length })
      : t("loadMoreHint", {
          shown: recurring.items.length,
          total: recurring.totalCount,
        });
  }, [oneOff, recurring, t, tab]);

  return (
    <div className="im-schedule-page" data-testid="schedule-page">
      <AppPageShell width="fluid">
        <ScheduleToolbar
          t={t}
          tab={tab}
          searchQuery={searchQuery}
          onTabChange={setTab}
          onSearchQueryChange={setSearchQuery}
          onCreate={dialogs.openCreate}
        />

        {loading ? <SkeletonScreen variant="card-grid" /> : null}

        {!loading && itemsEmpty ? (
          <EmptyState
            title={tab === "oneOff" ? t("empty.oneOff") : t("empty.recurring")}
            description={tab === "oneOff" ? t("empty.oneOffHint") : t("empty.recurringHint")}
            actions={
              <Button variant="primary" onClick={dialogs.openCreate} data-testid="schedule-empty-create">
                {t("create")}
              </Button>
            }
          />
        ) : null}

        {!loading && !itemsEmpty && tab === "oneOff" ? (
          <>
            <div aria-label={t("gridAria")} data-testid="schedule-one-off-grid">
              <CardGrid>
                {oneOff.items.map((event) => (
                  <ScheduleOneOffCard
                    key={event.id}
                    event={event}
                    worksetName={
                      event.worksetId
                        ? dialogs.worksetNameById.get(event.worksetId) ?? null
                        : null
                    }
                    itemLabel={
                      event.itemId ? itemTitleById.get(event.itemId) ?? event.itemId : null
                    }
                    onEdit={() => dialogs.openEditOneOff(event)}
                    onDelete={() => dialogs.requestDeleteOneOff(event)}
                  />
                ))}
              </CardGrid>
            </div>
            <LoadMoreFooter
              ref={oneOff.setLoadMoreTriggerRef}
              hint={loadMoreHint}
              hasMore={oneOff.hasMore}
              loadingMore={oneOff.loadingMore}
              onLoadMore={() => {
                void oneOff.loadMore();
              }}
              asDataListFooter={false}
            />
          </>
        ) : null}

        {!loading && !itemsEmpty && tab === "recurring" ? (
          <>
            <div aria-label={t("gridAria")} data-testid="schedule-recurring-grid">
              <CardGrid>
                {recurring.items.map((task) => (
                  <ScheduleRecurringCard
                    key={task.id}
                    task={task}
                    worksetName={
                      task.worksetId
                        ? dialogs.worksetNameById.get(task.worksetId) ?? null
                        : null
                    }
                    onEdit={() => dialogs.openEditRecurring(task)}
                    onDelete={() => dialogs.requestDeleteRecurring(task)}
                  />
                ))}
              </CardGrid>
            </div>
            <LoadMoreFooter
              ref={recurring.setLoadMoreTriggerRef}
              hint={loadMoreHint}
              hasMore={recurring.hasMore}
              loadingMore={recurring.loadingMore}
              onLoadMore={() => {
                recurring.loadMore();
              }}
              asDataListFooter={false}
            />
          </>
        ) : null}

        <UserEventDialog
          open={dialogs.dialogOpen}
          mode={dialogs.dialogMode}
          initial={dialogs.dialogInitial}
          worksetOptions={dialogs.worksetOptions}
          busy={dialogs.dialogBusy}
          error={dialogs.dialogError}
          titleOverride={dialogs.dialogTitleOverride}
          parentItemMode="editable"
          onClose={dialogs.closeDialog}
          onSubmit={(values) => {
            void dialogs.handleSubmit(values);
          }}
        />

        {dialogs.deleteTarget ? (
          <ConfirmDialog
            title={
              dialogs.deleteTarget.kind === "oneOff"
                ? t("deleteOneOffTitle")
                : t("deleteRecurringTitle")
            }
            body={
              dialogs.deleteTarget.kind === "oneOff"
                ? t("deleteOneOffMessage", { title: dialogs.deleteTarget.title })
                : t("deleteRecurringMessage", { title: dialogs.deleteTarget.title })
            }
            confirmLabel={t("card.delete")}
            confirmBusyLabel={tCommon("dialog.deleting")}
            busy={dialogs.deleting}
            onCancel={dialogs.cancelDelete}
            onConfirm={() => dialogs.confirmDelete()}
          />
        ) : null}
      </AppPageShell>
    </div>
  );
}
