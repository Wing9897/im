import { useEffect, useState } from "react";

import {
  sameSubscribeSelection,
  toggleSubscribeKey,
  type SubscribeCalendarIdentity,
  type SubscribedCalendarSelection,
} from "./subscribedCalendars";

type Options = {
  open: boolean;
  subscribeCalendars: readonly SubscribeCalendarIdentity[];
  selectedSubscribeKeys: SubscribedCalendarSelection;
  onChangeSubscribeKeys?: (next: SubscribedCalendarSelection) => void;
  localIsFiltering: boolean;
  localFilterBadgeCount: number;
  localApplyDisabled: boolean;
  applyLocal: () => void;
};

/** Shared subscribe draft + badge/apply merge for board and Timeline filter dialogs. */
export function useSourceFilterSubscribeDraft({
  open,
  subscribeCalendars,
  selectedSubscribeKeys,
  onChangeSubscribeKeys,
  localIsFiltering,
  localFilterBadgeCount,
  localApplyDisabled,
  applyLocal,
}: Options) {
  const catalogKeys = subscribeCalendars.map((row) => row.key);
  const subscribeCatalogReady = catalogKeys.length > 0;
  const [draftSubscribe, setDraftSubscribe] = useState<SubscribedCalendarSelection>(
    selectedSubscribeKeys,
  );

  useEffect(() => {
    if (!open) return;
    setDraftSubscribe(selectedSubscribeKeys);
  }, [open, selectedSubscribeKeys]);

  const subscribeFiltering = selectedSubscribeKeys !== null && subscribeCatalogReady;
  const isFiltering = localIsFiltering || subscribeFiltering;
  const filterBadgeCount =
    (localIsFiltering ? localFilterBadgeCount : 0) +
    (selectedSubscribeKeys === null || !subscribeCatalogReady ? 0 : selectedSubscribeKeys.length);
  const subscribeDirty = !sameSubscribeSelection(draftSubscribe, selectedSubscribeKeys);
  const applyDisabled = localApplyDisabled && !subscribeDirty;

  const apply = () => {
    applyLocal();
    if (subscribeDirty) {
      onChangeSubscribeKeys?.(draftSubscribe);
    }
  };

  return {
    catalogKeys,
    subscribeCatalogReady,
    draftSubscribe,
    isFiltering,
    filterBadgeCount,
    applyDisabled,
    apply,
    toggleKey: (key: string) =>
      setDraftSubscribe(toggleSubscribeKey(draftSubscribe, key, catalogKeys)),
    selectAllSubscribe: () => setDraftSubscribe(null),
    clearAllSubscribe: () => setDraftSubscribe([]),
  };
}
