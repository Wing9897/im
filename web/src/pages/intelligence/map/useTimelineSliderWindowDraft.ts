import { useCallback, useEffect, useRef, useState } from "react";

/**
 * RAF-coalesced scrub draft for the map timeline slider.
 * Preview updates client filter only; commit hits the API once.
 */
export function useTimelineSliderWindowDraft(options: {
  onTimeWindowChange: (window: { start: Date; end: Date }) => void;
  onCommitFetchWindow?: (window: { start: Date; end: Date }) => void;
  onExitLiveMode: () => void;
  liveMode: boolean;
}) {
  const { onTimeWindowChange, onCommitFetchWindow, onExitLiveMode, liveMode } = options;

  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const draftRef = useRef<{ start: number; end: number } | null>(null);
  const pendingPreviewRef = useRef<{ start: number; end: number } | null>(null);
  const previewFrameRef = useRef<number | null>(null);

  const liveModeRef = useRef(liveMode);
  liveModeRef.current = liveMode;
  const onExitLiveModeRef = useRef(onExitLiveMode);
  onExitLiveModeRef.current = onExitLiveMode;
  const onTimeWindowChangeRef = useRef(onTimeWindowChange);
  onTimeWindowChangeRef.current = onTimeWindowChange;
  const onCommitFetchWindowRef = useRef(onCommitFetchWindow);
  onCommitFetchWindowRef.current = onCommitFetchWindow;

  const exitLiveIfNeeded = useCallback(() => {
    if (liveModeRef.current) {
      liveModeRef.current = false;
      onExitLiveModeRef.current();
    }
  }, []);

  const commitFetch = useCallback((start: number, end: number) => {
    const window = { start: new Date(start), end: new Date(end) };
    onTimeWindowChangeRef.current(window);
    onCommitFetchWindowRef.current?.(window);
  }, []);

  const flushPreview = useCallback(() => {
    const pending = pendingPreviewRef.current;
    if (!pending) return;
    pendingPreviewRef.current = null;
    // Preview only — client filter; never hit the API while scrubbing.
    onTimeWindowChangeRef.current({
      start: new Date(pending.start),
      end: new Date(pending.end),
    });
  }, []);

  const cancelPreviewFrame = useCallback(() => {
    if (previewFrameRef.current != null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
  }, []);

  const previewWindow = useCallback(
    (start: number, end: number) => {
      exitLiveIfNeeded();
      const next = { start, end };
      draftRef.current = next;
      setDraft(next);
      pendingPreviewRef.current = next;
      if (previewFrameRef.current == null) {
        previewFrameRef.current = window.requestAnimationFrame(() => {
          previewFrameRef.current = null;
          flushPreview();
        });
      }
    },
    [exitLiveIfNeeded, flushPreview],
  );

  const emitDraft = useCallback(
    (start: number, end: number) => {
      previewWindow(start, end);
    },
    [previewWindow],
  );

  const commitWindow = useCallback(
    (start: number, end: number) => {
      exitLiveIfNeeded();
      cancelPreviewFrame();
      pendingPreviewRef.current = null;
      draftRef.current = null;
      setDraft(null);
      commitFetch(start, end);
    },
    [cancelPreviewFrame, commitFetch, exitLiveIfNeeded],
  );

  const clearDraftAfterGesture = useCallback(() => {
    const finalDraft = draftRef.current ?? pendingPreviewRef.current;
    cancelPreviewFrame();
    pendingPreviewRef.current = null;
    draftRef.current = null;
    setDraft(null);
    return finalDraft;
  }, [cancelPreviewFrame]);

  useEffect(
    () => () => {
      cancelPreviewFrame();
      flushPreview();
    },
    [cancelPreviewFrame, flushPreview],
  );

  return {
    draft,
    draftRef,
    exitLiveIfNeeded,
    emitDraft,
    commitWindow,
    commitFetch,
    cancelPreviewFrame,
    clearDraftAfterGesture,
  };
}
