import { useMemo } from "react";

import { useTaskCatalog, useWorksetNameById } from "../../context/TaskCatalogContext";
import { useSubscribeCatalogLookups } from "../calendarShare/subscribedCatalogLookups";
import { type EventListCardMetaLookups } from "./eventListCardMeta";
import { useGeneralWorksetLabel } from "./useGeneralWorksetLabel";

/** Assembles affiliation / provenance lookup maps for event list cards and rows. */
export function useEventListMetaLookups(): EventListCardMetaLookups {
  const { tasks } = useTaskCatalog();
  const { subscribeOwnerAvatarByHandle, subscribeDescriptionByKey } =
    useSubscribeCatalogLookups();
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();
  const taskWorksetById = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      if (typeof task.worksetId === "string" && task.worksetId.trim()) {
        map.set(task.id, task.worksetId.trim());
      }
    }
    return map;
  }, [tasks]);
  return useMemo<EventListCardMetaLookups>(
    () => ({
      generalWorksetLabel,
      worksetNameById,
      taskWorksetById,
      subscribeOwnerAvatarByHandle,
      subscribeDescriptionByKey,
    }),
    [
      generalWorksetLabel,
      worksetNameById,
      taskWorksetById,
      subscribeOwnerAvatarByHandle,
      subscribeDescriptionByKey,
    ],
  );
}
