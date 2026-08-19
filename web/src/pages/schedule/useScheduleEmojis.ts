import { useCallback, useEffect, useState } from "react";

import {
  hydrateScheduleEmojis,
  loadScheduleEmojis,
  saveScheduleEmojis,
  type ScheduleEmojiMap,
} from "./scheduleEmojisStore";

const EMOJI_SAVE_DEBOUNCE_MS = 400;

/** Read-only hydrate of the shared `schedule_emojis` map (timeline + schedule). */
export function useScheduleEmojisMap(): ScheduleEmojiMap {
  const [emojis, setEmojis] = useState<ScheduleEmojiMap>(() => loadScheduleEmojis());

  useEffect(() => {
    let cancelled = false;
    void hydrateScheduleEmojis().then((data) => {
      if (cancelled) return;
      setEmojis(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return emojis;
}

export function useScheduleEmojis() {
  const [emojis, setEmojis] = useState<ScheduleEmojiMap>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void hydrateScheduleEmojis().then((data) => {
      if (cancelled) return;
      setEmojis(data);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      void saveScheduleEmojis(emojis);
    }, EMOJI_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [emojis, ready]);

  const setItemEmoji = useCallback((key: string, glyph: string) => {
    const clean = glyph.trim();
    setEmojis((current) => {
      if (!clean) {
        if (!(key in current)) return current;
        const next = { ...current };
        delete next[key];
        return next;
      }
      if (current[key] === clean) return current;
      return { ...current, [key]: clean };
    });
  }, []);

  return { emojis, setItemEmoji, emojisReady: ready };
}
