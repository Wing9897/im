/**
 * Manage-area schedule page: unified list of one-off user events + recurring series.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { UserEventDialog } from "../../components/calendar/UserEventDialog";
import { EmptyState } from "../../components/common/EmptyState";
import { EmptyStateGlyph } from "../../components/common/EmptyStateGlyph";
import { CalendarClock } from "lucide-react";
import { SkeletonScreen } from "../../components/common/SkeletonScreen";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import {
  AppPageShell,
  Button,
  CardGrid,
  LoadMoreFooter,
} from "../../components/ui";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { SCHEDULE_FILTERS_STORAGE_KEY, SCHEDULE_SEARCH_STORAGE_KEY } from "../../domain/prefs";
import { useErrorToast } from "../../hooks/useErrorToast";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { usePersistedState } from "../../hooks/usePersistedState";
import { useSlashFocusSearch } from "../../hooks/useSlashFocusSearch";
import { ScheduleOneOffCard, ScheduleRecurringCard } from "./ScheduleEventCard";
import {
  DEFAULT_SCHEDULE_FILTERS,
  filterScheduleEntriesByDate,
  normalizeScheduleFilters,
  scheduleDateQueryWindow,
  scheduleFiltersAreActive,
  type ScheduleListFilters,
} from "./scheduleFilters";
import { mergeScheduleList } from "./scheduleList";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { useScheduleOneOffFeed } from "./useScheduleOneOffFeed";
import { useSchedulePageDialogs } from "./useSchedulePageDialogs";
import { useScheduleRecurringFeed } from "./useScheduleRecurringFeed";
import { updateUserEvent } from "../../api/userEvents";
import { patchRecurringSeries } from "../../api/recurringSeries";
import { lookupScheduleEmoji } from "../../domain/schedule/scheduleEmoji";

export function SchedulePage() {
  const { t } = useTranslation("schedule");
  const { t: tCommon } = useTranslation("common");
  const { worksets } = useTaskCatalog();
  const [searchQuery, setSearchQuery] = usePersistedState(SCHEDULE_SEARCH_STORAGE_KEY, "", {
    persistDebounceMs: 400,
    storage: "session",
  });
  const [filters, setFilters] = usePersistedState<ScheduleListFilters>(
    SCHEDULE_FILTERS_STORAGE_KEY,
    DEFAULT_SCHEDULE_FILTERS,
    { storage: "session" },
  );
  const normalizedFilters = useMemo(() => normalizeScheduleFilters(filters), [filters]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);

  useSlashFocusSearch(true);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const dateWindow = useMemo(
    () => scheduleDateQueryWindow(normalizedFilters.startDay, normalizedFilters.endDay),
    [normalizedFilters.endDay, normalizedFilters.startDay],
  );
  const loadOneOff = normalizedFilters.type !== "recurring";
  const loadRecurring = normalizedFilters.type !== "oneOff";

  const oneOff = useScheduleOneOffFeed({
    debouncedSearch,
    worksetId: normalizedFilters.worksetId || undefined,
    start: dateWindow.start,
    end: dateWindow.end,
    enabled: loadOneOff,
  });
  const recurring = useScheduleRecurringFeed({
    debouncedSearch,
    worksetId: normalizedFilters.worksetId || undefined,
    enabled: loadRecurring,
  });

  const dialogs = useSchedulePageDialogs({
    reloadOneOff: oneOff.reload,
    reloadRecurring: recurring.reload,
  });

  const entries = useMemo(() => {
    const merged = mergeScheduleList(oneOff.items, recurring.items);
    return filterScheduleEntriesByDate(
      merged,
      normalizedFilters.startDay,
      normalizedFilters.endDay,
    );
  }, [
    normalizedFilters.endDay,
    normalizedFilters.startDay,
    oneOff.items,
    recurring.items,
  ]);

  const feedError = oneOff.error || recurring.error;
  useErrorToast(feedError);

  const filtersActive = scheduleFiltersAreActive(normalizedFilters);
  const loading =
    (oneOff.initialLoading || recurring.initialLoading) && entries.length === 0;
  const itemsEmpty = !loading && entries.length === 0;
  const hasMore = oneOff.hasMore || recurring.hasMore;
  const loadingMore = oneOff.loadingMore || recurring.loadingMore;
  const shownCount = entries.length;
  const totalCount = oneOff.totalCount + recurring.totalCount;

  const loadMoreOneOff = oneOff.loadMore;
  const loadMoreRecurring = recurring.loadMore;
  const loadMore = useCallback(() => {
    void loadMoreOneOff();
    void loadMoreRecurring();
  }, [loadMoreOneOff, loadMoreRecurring]);

  useInfiniteScroll({
    triggerNode: loadMoreNode,
    onLoadMore: loadMore,
    disabled: loading || !hasMore,
    root: null,
    rootMargin: "0px 0px 240px 0px",
  });

  const loadMoreHint = useMemo(() => {
    return hasMore
      ? t("loadMoreHintHasMore", { shown: shownCount })
      : t("loadMoreHint", { shown: shownCount, total: totalCount });
  }, [hasMore, shownCount, t, totalCount]);

  return (
    <div className="im-schedule-page" data-testid="schedule-page">
      <AppPageShell width="fluid">
        <ScheduleToolbar
          t={t}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filters={normalizedFilters}
          onFiltersChange={setFilters}
          worksets={worksets}
          onCreate={dialogs.openCreate}
        />

        {loading ? <SkeletonScreen variant="card-grid" /> : null}

        {!loading && itemsEmpty ? (
          <EmptyState
            illustration={<EmptyStateGlyph icon={CalendarClock} />}
            title={filtersActive ? t("emptyFiltered.title") : t("empty.title")}
            description={filtersActive ? t("emptyFiltered.hint") : t("empty.hint")}
            actions={
              filtersActive ? (
                <Button
                  variant="secondary"
                  onClick={() => setFilters(DEFAULT_SCHEDULE_FILTERS)}
                  data-testid="schedule-empty-clear-filters"
                >
                  {t("filter.clear")}
                </Button>
              ) : (
                <Button variant="primary" onClick={dialogs.openCreate} data-testid="schedule-empty-create">
                  {t("create")}
                </Button>
              )
            }
          />
        ) : null}

        {!loading && !itemsEmpty ? (
          <>
            <div aria-label={t("gridAria")} data-testid="schedule-grid">
              <CardGrid>
                {entries.map((entry) =>
                  entry.kind === "oneOff" ? (
                    <ScheduleOneOffCard
                      key={`oneOff:${entry.event.id}`}
                      event={entry.event}
                      emoji={lookupScheduleEmoji({ source: "user", emoji: entry.event.emoji })}
                      worksetName={
                        entry.event.worksetId
                          ? dialogs.worksetNameById.get(entry.event.worksetId) ?? null
                          : null
                      }
                      onEdit={() => dialogs.openEditOneOff(entry.event)}
                      onDelete={() => dialogs.requestDeleteOneOff(entry.event)}
                      onEmojiChange={async (glyph) => {
                        await updateUserEvent(entry.event.id, { emoji: glyph.trim() || null });
                        await oneOff.reload();
                      }}
                    />
                  ) : (
                    <ScheduleRecurringCard
                      key={`recurring:${entry.series.id}`}
                      task={entry.series}
                      emoji={lookupScheduleEmoji({ source: "recurring", emoji: entry.series.emoji })}
                      worksetName={
                        entry.series.worksetId
                          ? dialogs.worksetNameById.get(entry.series.worksetId) ?? null
                          : null
                      }
                      onEdit={() => dialogs.openEditRecurring(entry.series)}
                      onDelete={() => dialogs.requestDeleteRecurring(entry.series)}
                      onToggleActive={() => dialogs.toggleRecurringActive(entry.series)}
                      onEmojiChange={async (glyph) => {
                        await patchRecurringSeries(entry.series.id, { emoji: glyph.trim() || null });
                        await recurring.reload();
                      }}
                    />
                  ),
                )}
              </CardGrid>
            </div>
            <LoadMoreFooter
              ref={setLoadMoreNode}
              hint={loadMoreHint}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
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
