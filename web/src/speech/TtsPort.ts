/** Reserved TTS providers — only `browser` is implemented in v1. */
export type TtsProviderId = "browser" | "doubao";

export interface TtsSpeakOptions {
  lang?: string;
  rate?: number;
  /** ``SpeechSynthesisVoice.voiceURI``; omit for browser default for ``lang``. */
  voiceUri?: string;
}

/**
 * Text-to-speech port. Optional IO for assistant replies;
 * Agent core stays text-only.
 */
export interface TtsPort {
  readonly providerId: TtsProviderId;
  isAvailable(): boolean;
  speak(text: string, opts?: TtsSpeakOptions): Promise<void>;
  cancel(): void;
}
