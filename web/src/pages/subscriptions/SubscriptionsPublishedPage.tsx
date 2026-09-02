import { Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  patchCalendarSharePublishAutoSync,
  syncCalendarSharePublish,
  unpublishCalendarSharePublish,
  type CalendarSharePublishListItem,
} from "../../api/calendarShare";
import { Button, MenuSelect } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  calendarShareKey,
  subscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";
import { isListedPublish } from "../../domain/calendarShare/publishWorkset";
import { useCalendarShareCatalog } from "../../domain/calendarShare/useCalendarShareCatalog";
import { useSubscribeCatalogFilter } from "../../domain/calendarShare/useSubscribeCatalogFilter";
import { useUserProfile } from "../../domain/user/userProfile";
import { toErrorMessage } from "../../utils/errors";
import {
  AUTO_SYNC_PRESET_SECONDS,
  autoSyncPatchFromPreset,
  autoSyncPresetFromRow,
  type AutoSyncPresetValue,
} from "../../domain/calendarShare/autoSyncPresets";
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

type PublishedBusyAction = { worksetId: string; action: "sync" | "unpublish" } | null;

/** This device's public calendars: list, unpublish, and publish/update from a local workset. */
export function SubscriptionsPublishedPage() {
  const { t } = useTranslation("subscriptions");
  const catalog = useCalendarShareCatalog();
  const { profile } = useUserProfile();
  const {
    items,
    setItems,
    worksets,
    listReady,
    loadError,
    load,
    onPublishSaved,
    autoSync,
    setAutoSync,
    autoSyncIntervalSeconds,
    setAutoSyncIntervalSeconds,
    autoSyncIntervalFloorSeconds,
  } = useSubscriptionsPublishedList();
  const [selectedId, setSelectedId] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<PublishedBusyAction>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formReady, setFormReady] = useState(false);
  const publishSubmitRef = useRef<(() => Promise<boolean>) | null>(null);

  const onUnpublish = useCallback(
    async (row: CalendarSharePublishListItem) => {
      setBusyAction({ worksetId: row.worksetId, action: "unpublish" });
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
        setBusyAction(null);
      }
    },
    [load, setItems],
  );

  const onSync = useCallback(
    async (row: CalendarSharePublishListItem) => {
      setBusyAction({ worksetId: row.worksetId, action: "sync" });
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
        setBusyAction(null);
      }
    },
    [load],
  );

  const [autoSyncBusy, setAutoSyncBusy] = useState(false);

  const onAutoSyncChange = useCallback(
    async (preset: AutoSyncPresetValue) => {
      setAutoSyncBusy(true);
      try {
        const saved = await patchCalendarSharePublishAutoSync(autoSyncPatchFromPreset(preset));
        setActionError(null);
        setAutoSync(saved.autoSync ?? preset !== "off");
        setAutoSyncIntervalSeconds(saved.autoSyncIntervalSeconds ?? autoSyncIntervalFloorSeconds);
        setItems((saved.items ?? []).filter(isListedPublish));
      } catch (error) {
        setActionError(toErrorMessage(error));
      } finally {
        setAutoSyncBusy(false);
      }
    },
    [setItems, setAutoSync, setAutoSyncIntervalSeconds, autoSyncIntervalFloorSeconds],
  );

  const status = subscribePageStatus({
    loading: catalog.loading,
    connected: catalog.session?.connected,
    unreachable: catalog.unreachable,
  });
  const canMutate = status === "ok";
  const handle = catalog.ownHandle || catalog.session?.handle || "";
  const ownerAvatar = (profile.avatarDataUrl ?? "").trim();
  const error = actionError ?? loadError;
  const { listFilter, setListFilter, visible, filtering } = useSubscribeCatalogFilter(
    items,
    (row) => [
      handle,
      row.slug,
      row.worksetName,
      row.worksetId,
      handle ? calendarShareKey(handle, row.slug) : "",
    ],
    handle,
  );

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
      toolbar={
        <SubscriptionsListToolbar
          value={listFilter}
          onChange={setListFilter}
          testId="subscriptions-published-filter"
          status={status}
          loggedOutTitle={t("published.needLogin")}
          actions={
            <>
              <MenuSelect
                variant="toolbar"
                menuPortal
                value={String(autoSyncPresetFromRow(autoSync, autoSyncIntervalSeconds, autoSyncIntervalFloorSeconds))}
                options={AUTO_SYNC_PRESET_SECONDS.map((value) => ({
                  value: String(value),
                  label: t(`published.autoSync.presets.${value}`),
                }))}
                disabled={!canMutate || autoSyncBusy}
                onChange={(next) => {
                  const preset = (next === "off" ? "off" : Number(next)) as AutoSyncPresetValue;
                  void onAutoSyncChange(preset);
                }}
                aria-label={t("published.autoSync.label")}
                data-testid="subscriptions-published-auto-sync"
              />
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
            </>
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
            ownerAvatar={ownerAvatar}
            canMutate={canMutate}
            autoSyncEnabled={autoSync}
            busyAction={busyAction}
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
