/**
 * Release-to-send policy for assistant voice PTT.
 *
 * Only STT-originated text is submitted. Empty recognition must never fall back
 * to a typed-only composer draft (short press / no-speech).
 *
 * Chrome may deliver the last partial only via ``onTranscript`` → draft, or clear
 * ``heardText`` during ``stop()`` races — ``hadSttTranscript`` gates draft reuse.
 */

/** Return trimmed STT text ready to send, or null when there is nothing to send. */
export function takeHeardTextForSend(heardText: string): string | null {
  const content = heardText.trim();
  return content.length > 0 ? content : null;
}

export type VoiceReleaseTextInput = {
  /** ``heardTextRef`` after ``stopSttOnly`` (may include a late final). */
  heardAfterStop: string;
  /** Snapshot before teardown. */
  heardBeforeStop: string;
  /** Composer draft before teardown (mirrors live STT via ``onTranscript``). */
  draftBeforeStop: string;
  /**
   * True when this listen session received a non-empty partial/final.
   * Required before draft may be used — blocks typed-draft auto-send.
   */
  hadSttTranscript: boolean;
};

/**
 * Pick text for release-to-send after STT teardown.
 * Prefer heard refs; only then draft, and only if STT actually produced text.
 */
export function resolveVoiceReleaseText(input: VoiceReleaseTextInput): string | null {
  return (
    takeHeardTextForSend(input.heardAfterStop) ??
    takeHeardTextForSend(input.heardBeforeStop) ??
    (input.hadSttTranscript ? takeHeardTextForSend(input.draftBeforeStop) : null)
  );
}
