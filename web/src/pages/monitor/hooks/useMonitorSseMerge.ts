import {
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import type { Message, MessageFilters } from "../../../types";
import { matchesFilters, mergeUniqueMessages } from "../monitorPageModel";

interface UseMonitorSseMergeOptions {
  filters: MessageFilters;
  streamEnabled: boolean;
  messagesRef: MutableRefObject<Message[]>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setTotalCount: Dispatch<SetStateAction<number>>;
}

/**
 * Live SSE merge for stream mode + wall-mode total increments.
 *
 * INVARIANTS:
 * - Stream: prepend/merge into `messages` with sequence tracking for refresh rebase.
 * - Wall: bump `totalCount` only — do not inject into the wall carousel list here.
 * - Filter changes reset merge buffers; do not skip that reset when “simplifying”.
 */
export function useMonitorSseMerge({
  filters,
  streamEnabled,
  messagesRef,
  setMessages,
  setTotalCount,
}: UseMonitorSseMergeOptions) {
  const { lastMessagesUpdate } = useAnalysisStatus();
  const sseSequenceRef = useRef(0);
  const sseMessagesRef = useRef(
    new Map<string, { sequence: number; message: Message }>(),
  );
  const wallSseCountRef = useRef(0);

  useEffect(() => {
    if (streamEnabled) return;
    const incoming = lastMessagesUpdate?.payload.messages;
    if (!incoming || incoming.length === 0) return;

    let novelCount = 0;
    for (const message of incoming) {
      if (matchesFilters(message, filters)) novelCount += 1;
    }
    if (novelCount > 0) {
      wallSseCountRef.current += novelCount;
      setTotalCount((prev) => prev + novelCount);
    }
  }, [filters, lastMessagesUpdate, setTotalCount, streamEnabled]);

  useEffect(() => {
    if (!streamEnabled) return;
    const incoming = lastMessagesUpdate?.payload.messages;
    if (!incoming || incoming.length === 0) return;

    const existingIds = new Set(messagesRef.current.map((message) => message.id));
    const novel = incoming.filter(
      (message) => matchesFilters(message, filters) && !existingIds.has(message.id),
    );
    if (novel.length === 0) return;

    for (const message of novel) {
      sseSequenceRef.current += 1;
      sseMessagesRef.current.set(message.id, {
        sequence: sseSequenceRef.current,
        message,
      });
    }

    setMessages((prev) => {
      const merged = mergeUniqueMessages(prev, novel, "prepend");
      messagesRef.current = merged;
      return merged;
    });
    setTotalCount((prev) => prev + novel.length);
  }, [
    filters,
    lastMessagesUpdate,
    messagesRef,
    setMessages,
    setTotalCount,
    streamEnabled,
  ]);

  return {
    sseSequenceRef,
    sseMessagesRef,
    wallSseCountRef,
  };
}
