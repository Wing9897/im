import { Plus } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  syncCalendarSharePublish,
  unpublishCalendarSharePublish,
  type CalendarSharePublishListItem,
} from "../../api/calendarShare";
import { Button } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  calendarShareKey,
  matchesCalendarShareFilter,
  subscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";
import { useCalendarShareCatalog } from "../../domain/calendarShare/useCalendarShareCatalog";
import { toErrorMessage } from "../../utils/errors";
import { SubscriptionsPublishedCard } from "./SubscriptionsPublishedCard";
import { SubscriptionsPublishModal } from "./SubscriptionsPublishModal";
import {
  SubscriptionsCardSection,
  SubscriptionsListToolbar,
  SubscriptionsPageChrome,
} from "./SubscriptionsPageChrome";
import {
  PUBLISHED_PENDING_SYNC_POLL_MS,
  useSubscriptionsPublishedList,
} from "./useSubscriptionsPublishedList";

export { PUBLISHED_PENDING_SYNC_POLL_MS };

/** This device's public calendars: list, unpublish, and publish/update from a local workset. */
export function SubscriptionsPublishedPage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const { items, setItems, worksets, listReady, loadError, load, onPublishSaved } =
    useSubscriptionsPublishedList();
  const [selectedId, setSelectedId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");
  const [formBusy, setFormBusy] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const publishSubmitRef = useRef<(() => Promise<boolean>) | null>(null);

  const onUnpublish = useCallback(
    async (row: CalendarSharePublishListItem) => {
      setBusyId(row.worksetId);
      try {
        await unpublishCalendarSharePublish(row);
        setActionError(null);
        try {
          await load();
        } catch {
          setItems((prev) => prev.filter((item) => item.worksetId !== row.worksetId));
        }
      } catch (error) {
        setActionError(toErrorMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [load, setItems],
  );

  const onSync = useCallback(
    async (row: CalendarSharePublishListItem) => {
      setBusyId(row.worksetId);
      try {
        await syncCalendarSharePublish(row);
        setActionError(null);
        try {
          await load();
        } catch {
          try {
            await load();
          } catch {
            // Upload already succeeded; leave the current card in place.
          }
        }
      } catch (error) {
        setActionError(toErrorMessage(error));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const status = subscribePageStatus({
    loading: catalog.loading,
    connected: catalog.session?.connected,
    unreachable: catalog.unreachable,
  });
  const canMutate = status === "ok";
  const handle = catalog.ownHandle || catalog.session?.handle || "";
  const error = actionError ?? loadError;
  const visible = useMemo(
    () =>
      items.filter((row) =>
        matchesCalendarShareFilter(
          listFilter,
          handle,
          row.slug,
          row.worksetName,
          row.worksetId,
          handle ? calendarShareKey(handle, row.slug) : "",
        ),
      ),
    [handle, items, listFilter],
  );
  const filtering = listFilter.trim().length > 0;

  const openPublishForm = (worksetId = "") => {
    setSelectedId(worksetId);
    setFormOpen(true);
  };

  const closePublishForm = () => {
    setFormOpen(false);
    setSelectedId("");
    setFormBusy(false);
    setFormReady(false);
    publishSubmitRef.current = null;
  };

  const onConfirmPublish = async () => {
    const submit = publishSubmitRef.current;
    if (!submit) return;
    const ok = await submit();
    if (ok) closePublishForm();
  };

  return (
    <SubscriptionsPageChrome
      status={status}
      error={error}
      loginMessage={t("published.needLogin")}
      toolbar={
        <SubscriptionsListToolbar
          value={listFilter}
          onChange={setListFilter}
          testId="subscriptions-published-filter"
          actions={
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!canMutate}
              onClick={() => openPublishForm("")}
              data-testid="subscriptions-published-open-form"
            >
              <Plus size={16} strokeWidth={2} aria-hidden />
              {t("published.publishCta")}
            </Button>
          }
        />
      }
    >
      <SubscriptionsCardSection
        status={status}
        loading={!listReady}
        hasItems={visible.length > 0}
        empty={<p className={`mb-0 ${formHelpClass}`}>{filtering ? t("listFilter.empty") : t("published.empty")}</p>}
        emptyTestId={filtering ? "subscriptions-published-filter-empty" : "subscriptions-published-empty"}
        listTestId="subscriptions-published-list"
      >
        {visible.map((row) => (
          <SubscriptionsPublishedCard
            key={row.worksetId}
            row={row}
            handle={handle}
            canMutate={canMutate}
            busyId={busyId}
            onSync={(item) => void onSync(item)}
            onEdit={openPublishForm}
            onUnpublish={(item) => void onUnpublish(item)}
            t={t}
          />
        ))}
      </SubscriptionsCardSection>

      {formOpen ? (
        <SubscriptionsPublishModal
          worksets={worksets}
          selectedId={selectedId}
          onSelectedId={setSelectedId}
          formBusy={formBusy}
          formReady={formReady}
          canMutate={canMutate}
          publishSubmitRef={publishSubmitRef}
          onBusyChange={setFormBusy}
          onReadyChange={setFormReady}
          onSaved={onPublishSaved}
          onClose={closePublishForm}
          onConfirm={() => void onConfirmPublish()}
        />
      ) : null}
    </SubscriptionsPageChrome>
  );
}
