import { useCallback, useEffect, useState } from "react";

import { lookupTaskEmoji } from "../../domain/tasks/taskEmoji";
import {
  hydrateTaskEmojis,
  loadTaskEmojis,
  saveTaskEmojis,
  subscribeTaskEmojis,
  type TaskEmojiMap,
} from "./taskEmojisStore";

/** Shared `task_emojis` map (timeline + task cards). Subscribes so a PUT is not wiped by a late GET. */
export function useTaskEmojisMap(): TaskEmojiMap {
  const [emojis, setEmojis] = useState<TaskEmojiMap>(() => loadTaskEmojis());

  useEffect(() => {
    const sync = () => setEmojis(loadTaskEmojis());
    const unsubscribe = subscribeTaskEmojis(sync);
    let cancelled = false;
    void hydrateTaskEmojis().then((data) => {
      if (cancelled) return;
      setEmojis(data);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return emojis;
}

export function useTaskEmoji(taskId: string | null | undefined) {
  const map = useTaskEmojisMap();
  const emoji = lookupTaskEmoji(map, taskId);

  const setEmoji = useCallback(
    async (glyph: string) => {
      const id = (taskId ?? "").trim();
      if (!id) return;
      const clean = glyph.trim();
      const current = loadTaskEmojis();
      const next: TaskEmojiMap = { ...current };
      if (!clean) {
        delete next[id];
      } else {
        next[id] = clean;
      }
      await saveTaskEmojis(next);
    },
    [taskId],
  );

  return { emoji, setEmoji, canEdit: Boolean((taskId ?? "").trim()) };
}
