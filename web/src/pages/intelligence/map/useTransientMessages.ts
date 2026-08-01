import { useEffect, useRef, useState } from "react";

export interface TransientMsg {
  id: string;
  title: string;
  content: string;
  addedAt: number;
}

const DEFAULT_DURATION_MS = 8000;

/** Queue short-lived overlay messages and expire them on an interval. */
export function useTransientMessages(durationMs = DEFAULT_DURATION_MS) {
  const [msgs, setMsgs] = useState<TransientMsg[]>([]);

  useEffect(() => {
    if (msgs.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setMsgs((prev) => prev.filter((message) => now - message.addedAt < durationMs));
    }, 1000);
    return () => clearInterval(timer);
  }, [durationMs, msgs.length]);

  return { msgs, setMsgs };
}

/** Skip the first effect run (initial mount) then react to subsequent deps. */
export function useSkipFirstEffect(effect: () => void, deps: readonly unknown[]) {
  const first = useRef(true);
  const effectRef = useRef(effect);
  effectRef.current = effect;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    effectRef.current();
    // Intentionally sync to caller-provided deps only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
