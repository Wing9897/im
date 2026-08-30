import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  BLOCK_CARD_COLOR_CSS,
  BLOCK_CARD_COLOR_IDS,
  BLOCK_CARD_CUSTOM_PICKER_FALLBACK,
  isPresetBlockCardColor,
  normalizeBlockCardHex,
  type BlockCardColorChoice,
} from "../../../domain/timeline/blockCardColors";

type TimelineSplitMonthColorControlProps = {
  color?: BlockCardColorChoice;
  onChange: (color: BlockCardColorChoice | null) => void;
};

export function TimelineSplitMonthColorControl({
  color,
  onChange,
}: TimelineSplitMonthColorControlProps) {
  const { t } = useTranslation("timeline");
  const [open, setOpen] = useState(false);
  const [lastHex, setLastHex] = useState(
    color?.kind === "hex" ? color.value : BLOCK_CARD_CUSTOM_PICKER_FALLBACK,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const paletteId = `split-month-color-palette-${reactId.replace(/:/g, "")}`;
  const isCustom = color?.kind === "hex";
  const pickerValue = isCustom ? color.value : lastHex;

  useEffect(() => {
    if (color?.kind === "hex") setLastHex(color.value);
  }, [color]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="im-split-month-color">
      <button
        type="button"
        className="im-split-month-color-swatch"
        data-testid="timeline-split-month-color"
        data-color={color?.kind === "preset" ? color.id : color?.kind === "hex" ? color.value : "default"}
        aria-label={t("calendar.cardColorAria")}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={paletteId}
        title={t("calendar.cardColorAria")}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      />
      {open ? (
        <div
          id={paletteId}
          role="listbox"
          aria-label={t("calendar.cardColorPaletteAria")}
          data-testid="timeline-split-month-color-palette"
          className="im-menu-surface im-split-month-color-palette"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="option"
            aria-selected={!color}
            aria-label={t("calendar.cardColorDefault")}
            title={t("calendar.cardColorDefault")}
            className={`im-split-month-color-option is-default${!color ? " is-selected" : ""}`}
            data-testid="timeline-split-month-color-option"
            data-color="default"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          />
          {BLOCK_CARD_COLOR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={isPresetBlockCardColor(color, id)}
              aria-label={t(`calendar.cardColorName.${id}`)}
              title={t(`calendar.cardColorName.${id}`)}
              className={`im-split-month-color-option${isPresetBlockCardColor(color, id) ? " is-selected" : ""}`}
              data-testid="timeline-split-month-color-option"
              data-color={id}
              style={{ background: BLOCK_CARD_COLOR_CSS[id] }}
              onClick={() => {
                onChange({ kind: "preset", id });
                setOpen(false);
              }}
            />
          ))}
          <label
            className={`im-split-month-color-custom${isCustom ? " is-selected" : ""}`}
            style={isCustom ? { background: color.value } : undefined}
            title={t("calendar.cardColorCustom")}
          >
            <span className="sr-only">{t("calendar.cardColorCustom")}</span>
            <input
              type="color"
              value={pickerValue}
              aria-label={t("calendar.cardColorCustom")}
              data-testid="timeline-split-month-color-custom"
              onInput={(event) => {
                const hex = normalizeBlockCardHex(event.currentTarget.value);
                if (!hex) return;
                setLastHex(hex);
                onChange({ kind: "hex", value: hex });
              }}
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}
