/**
 * STT provider ids. Only `browser` is implemented.
 */
export type SttProviderId = "browser";

export type SttEvent =
  | { type: "partial"; text: string }
  | { type: "final"; text: string }
  | { type: "error"; message: string };

export interface SttStartOptions {
  language?: string;
}

/**
 * Speech-to-text port. Agent / chat UI depends only on this surface.
 * Desktop Electron uses ``UnavailableStt`` (honest no-op); browser uses ``BrowserStt``.
 */
export interface SttPort {
  readonly providerId: SttProviderId;
  isAvailable(): boolean;
  start(opts?: SttStartOptions): Promise<void>;
  stop(): Promise<void>;
  subscribe(handler: (ev: SttEvent) => void): () => void;
}
