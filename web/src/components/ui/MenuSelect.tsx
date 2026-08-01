import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type MenuSelectOption = {
  value: string;
  label: string;
};

type MenuSelectProps = {
  id?: string;
  value: string;
  options: readonly MenuSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  disabled?: boolean;
};

const shellStyle: CSSProperties = {
  display: "block",
  position: "relative",
  width: "100%",
  minWidth: 280,
  maxWidth: "100%",
  boxSizing: "border-box",
};

const triggerStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  minWidth: 280,
  maxWidth: "100%",
  boxSizing: "border-box",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
  textAlign: "left",
};

const labelStyle: CSSProperties = {
  display: "block",
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const listStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(100% + 4px)",
  zIndex: 30,
  margin: 0,
  padding: 4,
  listStyle: "none",
  width: "100%",
  minWidth: 280,
  maxWidth: "100%",
  maxHeight: 280,
  overflowY: "auto",
  boxSizing: "border-box",
};

const optionStyle: CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  textAlign: "left",
  cursor: "pointer",
};

/**
 * Full-width button + listbox select.
 * Avoids native `<select>` / nested `min-w-0` collapse that squeezed CJK labels
 * into a ~1ch vertical strip on the theme settings page.
 */
export function MenuSelect({
  id,
  value,
  options,
  onChange,
  className,
  disabled = false,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: MenuSelectProps) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    const match = options.find((opt) => opt.value === value);
    if (match) return match;
    if (options[0]) return options[0];
    return { value, label: value || "—" };
  }, [options, value]);

  useEffect(() => {
    if (!open) return;
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocumentMouseDown);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [open]);

  const closeAndSelect = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div
      ref={rootRef}
      className={className}
      style={shellStyle}
      data-testid={testId}
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId ? `${testId}-value` : undefined}
        title={selected.label}
        className="rounded-md border border-surface-border bg-surface-card px-sm py-1.5 text-caption font-medium leading-snug text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        style={triggerStyle}
        onClick={() => {
          if (!disabled) setOpen((current) => !current);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span style={labelStyle}>{selected.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
          className={`shrink-0 text-text-secondary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="im-menu-surface rounded-md border border-surface-border bg-surface-card shadow-md"
          style={listStyle}
          data-testid={testId ? `${testId}-list` : undefined}
        >
          {options.map((opt) => {
            const isActive = opt.value === selected.value;
            return (
              <li key={opt.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  title={opt.label}
                  data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
                  className={[
                    "rounded-sm border-none px-sm py-1.5 text-caption leading-snug",
                    isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-card))] font-medium text-accent"
                      : "bg-transparent text-text-primary hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-card))]",
                  ].join(" ")}
                  style={optionStyle}
                  onClick={() => closeAndSelect(opt.value)}
                >
                  {opt.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
