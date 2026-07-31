import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fetchLatestByChannels } from "../../../api/channels";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { loadPhase } from "../../../hooks/loadPhase";
import { usePersistedState } from "../../../hooks/usePersistedState";
import type { ChannelWithAccount } from "../../../types";
import { toErrorMessage } from "../../../utils/errors";
import {
  advanceCarousel,
  bootstrapSlot,
  channelKeyForMessage,
  createEmptySlot,
  enqueueMessage,
  refreshSlot,
  type WallSlotState,
  WALL_QUEUE_LIMIT,
} from "../../../domain/monitor/wall/wallModel";
import { MONITOR_WALL_CHANNELS_STORAGE_KEY } from "../../../domain/prefs";
import { pruneWallSelectedChannelIds } from "../../../domain/monitor/wall/pruneWallSelectedChannelIds";

const SYNC_INTERVAL_MS = 30_000;

type WallSlotsState = Record<string, WallSlotState>;

function emptySlots(channelIds: string[]): WallSlotsState {
  return Object.fromEntries(channelIds.map((id) => [id, createEmptySlot()]));
}

function retainedMessageIds(slots: WallSlotsState): Set<string> {
  const ids = new Set<string>();
  for (const slot of Object.values(slots)) {
    for (const message of slot.queue) {
      ids.add(message.id);
    }
  }
  return ids;
}

/** Channel selection, per-slot queues, SSE + periodic sync for the monitor wall view. */
export function useWallData(
  channels: ChannelWithAccount[],
  onRetainedIdsChange?: (ids: Set<string>) => void,
  /** When false, skip pruning — catalog may still be loading as ``[]``. */
  channelsReady = true,
) {
  const { lastMessagesUpdate } = useAnalysisStatus();
  const latestBootstrap = useLatestRequest();
  const [selectedChannelIds, setSelectedChannelIds] = usePersistedState<string[]>(
    MONITOR_WALL_CHANNELS_STORAGE_KEY,
    [],
  );
  const [slots, setSlots] = useState<WallSlotsState>(() => emptySlots(selectedChannelIds));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRef = useRef(selectedChannelIds);

  useEffect(() => {
    selectedRef.current = selectedChannelIds;
  }, [selectedChannelIds]);

  // Drop localStorage wall picks that vanished after a DB reset / account removal.
  useEffect(() => {
    if (!channelsReady) return;
    const known = new Set(channels.map((channel) => channel.id));
    const pruned = pruneWallSelectedChannelIds(selectedChannelIds, known);
    if (pruned === null) return;
    selectedRef.current = pruned;
    setSelectedChannelIds(pruned);
    setSlots((prev) =>
      Object.fromEntries(
        pruned.map((channelId) => [channelId, prev[channelId] ?? createEmptySlot()]),
      ),
    );
  }, [channels, channelsReady, selectedChannelIds, setSelectedChannelIds]);

  const bootstrap = useCallback(async (channelIds: string[], showLoading = true) => {
    const requestVersion = latestBootstrap.begin();
    setError(null);
    if (channelIds.length === 0) {
      setSlots({});
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const payload = await fetchLatestByChannels(channelIds, WALL_QUEUE_LIMIT);
      if (!latestBootstrap.isCurrent(requestVersion)) return;
      setSlots((prev) => {
        const next: WallSlotsState = { ...emptySlots(channelIds) };
        for (const channelId of channelIds) {
          const existing = prev[channelId];
          const messages = payload[channelId] ?? [];
          if (existing && existing.queue.length > 0) {
            next[channelId] = refreshSlot(existing, messages);
          } else {
            next[channelId] = bootstrapSlot(messages);
          }
        }
        return next;
      });
    } catch (err) {
      if (latestBootstrap.isCurrent(requestVersion)) {
        setError(toErrorMessage(err));
      }
    } finally {
      if (latestBootstrap.isCurrent(requestVersion)) {
        setLoading(false);
      }
    }
  }, [latestBootstrap]);

  const retryBootstrap = useCallback(() => {
    void bootstrap(selectedRef.current);
  }, [bootstrap]);

  useEffect(() => {
    void bootstrap(selectedChannelIds);
  }, [bootstrap, selectedChannelIds]);

  useEffect(() => {
    onRetainedIdsChange?.(retainedMessageIds(slots));
  }, [onRetainedIdsChange, slots]);

  useEffect(() => {
    const incoming = lastMessagesUpdate?.payload.messages;
    if (!incoming?.length) return;

    const selected = new Set(selectedRef.current);
    if (selected.size === 0) return;

    setSlots((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const message of incoming) {
        const channelId = channelKeyForMessage(message);
        if (!selected.has(channelId)) continue;
        const slot = next[channelId] ?? createEmptySlot();
        const updated = enqueueMessage(slot, message);
        if (updated !== slot) {
          next[channelId] = updated;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [lastMessagesUpdate]);

  useEffect(() => {
    const sync = () => {
      const ids = selectedRef.current;
      if (ids.length === 0) return;
      void bootstrap(ids, false);
    };
    const timer = window.setInterval(sync, SYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [bootstrap]);

  const advanceSlot = useCallback((channelId: string) => {
    setSlots((prev) => {
      const slot = prev[channelId];
      if (!slot) return prev;
      return { ...prev, [channelId]: advanceCarousel(slot) };
    });
  }, []);

  const setSlotIndex = useCallback((channelId: string, index: number) => {
    setSlots((prev) => {
      const slot = prev[channelId];
      if (!slot) return prev;
      const clamped = Math.max(0, Math.min(index, slot.queue.length - 1));
      const unseenCount = clamped === slot.currentIndex ? slot.unseenCount : 0;
      return { ...prev, [channelId]: { ...slot, currentIndex: clamped, unseenCount } };
    });
  }, []);

  const channelById = useMemo(
    () => Object.fromEntries(channels.map((channel) => [channel.id, channel])),
    [channels],
  );

  const updateSelectedChannels = useCallback((channelIds: string[]) => {
    selectedRef.current = channelIds;
    setSelectedChannelIds(channelIds);
    setSlots((prev) =>
      Object.fromEntries(
        channelIds.map((channelId) => [channelId, prev[channelId] ?? createEmptySlot()]),
      ),
    );
  }, [setSelectedChannelIds]);

  const hasSlotData = selectedChannelIds.some(
    (id) => (slots[id]?.queue.length ?? 0) > 0,
  );
  const { initialLoading, isRefreshing } = loadPhase(loading, hasSlotData);

  return {
    channelById,
    selectedChannelIds,
    setSelectedChannelIds: updateSelectedChannels,
    slots,
    initialLoading,
    isRefreshing,
    error,
    retryBootstrap,
    advanceSlot,
    setSlotIndex,
  };
}
