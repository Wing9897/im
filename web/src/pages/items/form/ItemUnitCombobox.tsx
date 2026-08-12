import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ITEM_UNIT_PRESETS } from "../../../domain/items/itemUnitPresets";

type Props = {
  id?: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

/** Combobox: preset units + free-text custom unit. */
export function ItemUnitCombobox({ id, value, placeholder, disabled, onChange }: Props) {
  const { t } = useTranslation("items");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const shellFocused = focused || open;

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [open]);

  const presets = ITEM_UNIT_PRESETS.filter((preset) => {
    const needle = value.trim().toLowerCase();
    if (!needle) return true;
    return preset.toLowerCase().includes(needle);
  });

  return (
    <div ref={rootRef} className="relative min-w-0">
      <div
        className={[
          "im-surface-inset flex h-8 min-h-8 w-full items-stretch rounded-md border transition-[border-color,box-shadow] duration-200",
          shellFocused
            ? "border-[color-mix(in_srgb,var(--accent)_55%,var(--surface-border))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
            : "border-surface-border",
          disabled ? "opacity-50" : "",
        ].join(" ")}
      >
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          className="min-w-0 flex-1 border-none bg-transparent px-sm text-body text-text-primary outline-none disabled:cursor-not-allowed"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          data-testid="item-form-unit-input"
        />
        <button
          type="button"
          aria-label={t("unitPresetsAria")}
          aria-expanded={open}
          aria-controls={listId}
          disabled={disabled}
          className="flex w-8 shrink-0 items-center justify-center rounded-sm border-none bg-transparent p-0 text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary disabled:cursor-not-allowed"
          onClick={() => setOpen((current) => !current)}
        >
          <ChevronDown
            size={14}
            strokeWidth={2}
            aria-hidden="true"
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>
      {open && presets.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="im-menu-surface absolute left-0 right-0 top-[calc(100%+4px)] z-20 m-0 max-h-48 list-none overflow-y-auto rounded-md p-xs"
        >
          {presets.map((preset) => (
            <li key={preset} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === preset}
                className="block w-full cursor-pointer rounded-sm border-none bg-transparent px-sm py-sm text-left text-body text-text-primary hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-panel))]"
                onClick={() => {
                  onChange(preset);
                  setOpen(false);
                }}
              >
                {preset}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
