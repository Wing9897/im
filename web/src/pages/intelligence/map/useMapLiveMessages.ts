import { useEffect, useMemo, useState } from "react";

import type { Message } from "../../../types";
import { useAnalysisStatus } from "../../../context/AnalysisStatusContext";
import { queryMessagesPage } from "../../../api/messages";
import { captureError } from "../../../utils/errorReporter";
import { MAX_RUNTIME_MESSAGES, sortMessagesDesc } from "./mapViewHelpers";

/**
 * Sub-hook managing live message accumulation for the map view.
 * Loads initial messages and merges runtime updates.
 */
export function useMapLiveMessages() {
  const { lastMessagesUpdate } = useAnalysisStatus();
  const [initialLiveMessages, setInitialLiveMessages] = useState<Message[]>([]);
  const [runtimeMessages, setRuntimeMessages] = useState<Message[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadInitialLiveMessages = async () => {
      try {
        const page = await queryMessagesPage({ filters: {}, limit: 12 });
        if (cancelled) return;
        setInitialLiveMessages(sortMessagesDesc(page.messages));
      } catch (error) {
        if (cancelled) return;
        captureError(error, { component: "MapView", severity: "warning" });
      }
    };
    void loadInitialLiveMessages();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const incoming = lastMessagesUpdate?.payload.messages;
    if (!incoming || incoming.length === 0) return;
    setRuntimeMessages((prev) => {
      const nextById = new Map(prev.map((message) => [message.id, message]));
      for (const message of incoming) {
        nextById.set(message.id, message);
      }
      return sortMessagesDesc(Array.from(nextById.values())).slice(0, MAX_RUNTIME_MESSAGES);
    });
  }, [lastMessagesUpdate]);

  const mergedLiveMessages = useMemo(() => {
    const nextById = new Map<string, Message>();
    for (const message of initialLiveMessages) { nextById.set(message.id, message); }
    for (const message of runtimeMessages) { nextById.set(message.id, message); }
    return sortMessagesDesc(Array.from(nextById.values()));
  }, [initialLiveMessages, runtimeMessages]);

  const liveMessagesRecent = useMemo(() => mergedLiveMessages.slice(0, 12), [mergedLiveMessages]);
  const incomingLiveMessages = useMemo(
    () => sortMessagesDesc(lastMessagesUpdate?.payload.messages ?? []),
    [lastMessagesUpdate],
  );

  return {
    liveMessagesRecent,
    incomingLiveMessages,
  };
}
