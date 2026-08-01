/**
 * Reserved STT provider ids.
 * Only `browser` is implemented in v1.
 * `whisper` / `doubao` are type-level placeholders — no adapters yet; do not
 * treat selecting them as a working STT path.
 */
export type SttProviderId = "browser" | "whisper" | "doubao";

export type SttEvent =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "error"; message: string };

export interface SttStartOptions {
  language?: string;
}

/**
 * Speech-to-text port. Agent / chat UI depends only on this surface —
 * a future Whisper/Doubao adapter would plug in here without touching Agent Runtime.
 * Until then, only `BrowserStt` exists; reserved ids must not pretend to be available.
 */
export interface SttPort {
  readonly providerId: SttProviderId;
  isAvailable(): boolean;
  start(opts?: SttStartOptions): Promise<void>;
  stop(): Promise<void>;
  subscribe(handler: (ev: SttEvent) => void): () => void;
}
