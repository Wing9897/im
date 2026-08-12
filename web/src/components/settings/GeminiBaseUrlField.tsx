import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getGeminiBaseUrlPresets } from "../../domain/settings/llmProviderConfig";
import { captionClass, formLabelClass } from "../ui/pageTypography";

interface GeminiBaseUrlFieldProps {
  id?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export function GeminiBaseUrlField({
  id,
  value,
  placeholder,
  onChange,
}: GeminiBaseUrlFieldProps) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const presets = getGeminiBaseUrlPresets(t).filter((preset) => preset.id !== "custom");

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

  const shellFocused = focused || open;

  return (
    <div ref={rootRef} className="relative">
      <div
        className={[
          "im-surface-inset flex h-8 min-h-8 w-full items-stretch rounded-md border transition-[border-color,box-shadow] duration-200",
          shellFocused
            ? "border-[color-mix(in_srgb,var(--accent)_55%,var(--surface-border))] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_14%,transparent)]"
            : "border-surface-border",
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
          className="min-w-0 flex-1 border-none bg-transparent px-sm text-body text-text-primary outline-none"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        <button
          type="button"
          aria-label={t("llm.geminiVersionAria")}
          aria-expanded={open}
          aria-controls={listId}
          className="flex w-8 shrink-0 items-center justify-center rounded-sm border-none bg-transparent p-0 text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary"
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
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="im-menu-surface absolute left-0 right-0 top-[calc(100%+4px)] z-20 m-0 list-none rounded-md p-xs"
        >
          {presets.map((preset) => (
            <li key={preset.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === preset.url}
                className="block w-full cursor-pointer rounded-sm border-none bg-transparent px-sm py-sm text-left text-body text-text-primary hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-card))]"
                onClick={() => {
                  onChange(preset.url);
                  setOpen(false);
                }}
              >
                <span className={`block ${formLabelClass}`}>{preset.label}</span>
                <span className={`mt-xs block ${captionClass}`}>{preset.url}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
