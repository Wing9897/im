import { lazy, memo, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { EmojiClickData, EmojiStyle, Theme } from "emoji-picker-react";

import { loadEmojiPickerModule } from "./emojiPickerLoader";

/** Desk-dense default height shared by dialog + panel. */
export const DEFAULT_EMOJI_PICKER_HEIGHT = 236;

/**
 * Categories useful for item/category marks. Omits FLAGS (largest bucket) to
 * cut first-mount button count; smileys through symbols cover typical use.
 * String literals avoid a static value-import of emoji-picker-react (keeps code-split).
 */
const ITEM_EMOJI_CATEGORIES = [
  "suggested",
  "smileys_people",
  "animals_nature",
  "food_drink",
  "travel_places",
  "activities",
  "objects",
  "symbols",
] as const;

type Props = {
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Picker height in px (desk-dense default). */
  height?: number;
};

/** Resolve emoji-picker theme from app theme tokens (not OS-only AUTO). */
export function resolveEmojiPickerTheme(): Theme {
  const root = document.documentElement;
  const mode = root.getAttribute("data-theme-mode");
  if (mode === "dark") return "dark" as Theme;
  if (mode === "light") return "light" as Theme;
  const scheme = root.getAttribute("data-color-scheme");
  if (scheme === "dark") return "dark" as Theme;
  if (scheme === "light") return "light" as Theme;
  return "auto" as Theme;
}

/**
 * Force system Unicode glyphs (Segoe UI Emoji on Windows, etc.).
 * Do NOT use apple/google/facebook/twitter — those load PNGs from jsDelivr CDN.
 * With NATIVE the picker never calls getEmojiUrl / cdnUrl; emoji index ships in the npm chunk.
 */
const NATIVE_EMOJI_STYLE = "native" as EmojiStyle;

const LazyEmojiPicker = lazy(() =>
  loadEmojiPickerModule().then((mod) => ({ default: mod.default })),
);

function PickerFallback({ height }: { height: number }) {
  const { t } = useTranslation("items");
  return (
    <div
      className="flex items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-raised)_35%,transparent)] text-caption text-text-muted"
      style={{ height }}
      data-testid="emoji-picker-loading"
      aria-busy="true"
    >
      {t("emojiPickerLoading")}
    </div>
  );
}

/**
 * Shared emoji-picker-react chrome — used inside ModalDialog hosts.
 * Styling lives in `web/src/css/emoji-picker.css` (`.im-emoji-picker`).
 * Memoized so draft/avatar updates above the panel do not remount the heavy grid.
 *
 * Offline / no-CDN: always `emojiStyle={NATIVE}` so glyphs render from OS fonts;
 * the only network cost is loading our own bundled JS chunk (dynamic import), not emoji images.
 * Call `preloadEmojiPickerModule` / `scheduleEmojiPickerPreload` on Items idle
 * or trigger hover to hide first-open latency.
 */
export const EmojiPickerPanel = memo(function EmojiPickerPanel({
  onChange,
  disabled = false,
  height = DEFAULT_EMOJI_PICKER_HEIGHT,
}: Props) {
  const { t } = useTranslation("items");
  const pickerTheme = useMemo(() => resolveEmojiPickerTheme(), []);

  const handleEmojiClick = useCallback(
    (data: EmojiClickData) => {
      if (disabled) return;
      onChange(data.emoji);
    },
    [disabled, onChange],
  );

  return (
    <div
      className={[
        "im-emoji-picker-host overflow-hidden rounded-md border border-surface-border/70",
        "bg-[color-mix(in_srgb,var(--surface-card)_88%,transparent)]",
        "[&_.EmojiPickerReact]:!border-0 [&_.EmojiPickerReact]:!bg-transparent",
        disabled ? "pointer-events-none" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ minHeight: height }}
      data-testid="emoji-picker-grid"
      aria-label={t("emojiPickerAria")}
      aria-disabled={disabled || undefined}
    >
      <Suspense fallback={<PickerFallback height={height} />}>
        <LazyEmojiPicker
          className="im-emoji-picker"
          onEmojiClick={handleEmojiClick}
          theme={pickerTheme}
          emojiStyle={NATIVE_EMOJI_STYLE}
          width="100%"
          height={height}
          searchPlaceholder={t("emojiSearchPlaceholder")}
          previewConfig={{ showPreview: false }}
          skinTonesDisabled
          lazyLoadEmojis
          autoFocusSearch={false}
          categories={[...ITEM_EMOJI_CATEGORIES] as never}
        />
      </Suspense>
    </div>
  );
});
