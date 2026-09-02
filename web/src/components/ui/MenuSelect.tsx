import type { CSSProperties, KeyboardEvent, ReactElement, RefObject } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { anchoredMenuPortalStyle, useAnchoredMenu } from "../../hooks/useAnchoredMenu";
import { controlBaseClass, controlSizeClass } from "./controlStyles";

export type MenuSelectOption = {
  value: string;
  label: string;
  /** Shown in the list but not selectable. */
  disabled?: boolean;
  /** Consecutive options with the same group render a section header. */
  group?: string;
  /** Tooltip / title; defaults to `label` (full text when the row ellipsizes). */
  title?: string;
};

type MenuSelectVariant = "default" | "field" | "toolbar";

type MenuSelectProps = {
  id?: string;
  value: string;
  options: readonly MenuSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Extra classes on the field/toolbar trigger button (e.g. toolbar density). */
  triggerClassName?: string;
  /**
   * `field` — full-width form control (matches SelectField chrome).
   * `toolbar` — inline ops/chrome control; does **not** force `w-full`.
   * `default` — larger card-style trigger (theme pickers, etc.).
   */
  variant?: MenuSelectVariant;
  /** Portal the listbox to `document.body` so overflow ancestors cannot clip it. */
  menuPortal?: boolean;
  /**
   * When set, an unmatched / empty ``value`` shows this label instead of
   * silently falling back to ``options[0]`` (avoids fake “selected” chrome).
   */
  placeholder?: string;
  /** Filter options by label/group when the menu is open. */
  searchable?: boolean;
  searchPlaceholder?: string;
  searchEmptyLabel?: string;
  "aria-label"?: string;
  "aria-required"?: boolean;
  "data-testid"?: string;
  disabled?: boolean;
};

/** Form chrome without baked-in `w-full` — width comes from variant / className. */
const controlChromeClass = controlBaseClass.replace(/\bw-full\b/, "").replace(/\s+/g, " ").trim();

const fieldTriggerClass = `${controlChromeClass} ${controlSizeClass.md} w-full cursor-pointer text-left disabled:cursor-not-allowed`;

const toolbarTriggerClass = `${controlChromeClass} ${controlSizeClass.md} w-auto cursor-pointer text-left disabled:cursor-not-allowed`;

const fieldTriggerStyle: CSSProperties = {
  display: "flex",
  width: "100%",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
  textAlign: "left",
};

const toolbarTriggerStyle: CSSProperties = {
  display: "inline-flex",
  width: "auto",
  minWidth: 0,
  maxWidth: "100%",
  boxSizing: "border-box",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  cursor: "pointer",
  textAlign: "left",
};

const fieldLabelStyle: CSSProperties = {
  display: "block",
  flex: "1 1 auto",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--text-primary)",
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

/** Opaque elevated panel so options stay `--text-primary` on a readable surface. */
const listSurfaceStyle: CSSProperties = {
  background: "var(--surface-raised, var(--surface-card))",
  color: "var(--text-primary)",
};

const listBoxChromeStyle: CSSProperties = {
  margin: 0,
  padding: 4,
  listStyle: "none",
  maxHeight: 280,
  overflowY: "auto",
  scrollbarGutter: "stable",
  boxSizing: "border-box",
  ...listSurfaceStyle,
};

const listStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  top: "calc(100% + 4px)",
  zIndex: 30,
  width: "100%",
  minWidth: 280,
  maxWidth: "100%",
  ...listBoxChromeStyle,
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
 * Custom button + listbox select for **toolbar / chrome / ops bars**, and for dense
 * form rows that are a plain options list (prefer `variant="field"`).
 *
 * Disabled options, group headers, and in-menu search are supported here.
 * Prefer {@link SelectField} only when native `<select>` form-submit quirks are required.
 * Use `menuPortal` to escape overflow clipping. Shared placement lives in `useAnchoredMenu`.
 */
export function MenuSelect({
  id,
  value,
  options,
  onChange,
  className,
  triggerClassName,
  variant = "default",
  menuPortal = false,
  placeholder,
  searchable = false,
  searchPlaceholder,
  searchEmptyLabel,
  disabled = false,
  "aria-label": ariaLabel,
  "aria-required": ariaRequired,
  "data-testid": testId,
}: MenuSelectProps) {
  const isField = variant === "field";
  const isToolbar = variant === "toolbar";
  const usesFormChrome = isField || isToolbar;
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const [query, setQuery] = useState("");
  const { open, setOpen, menuPos, anchorRef, menuRef, rootRef } = useAnchoredMenu({
    enabled: !disabled,
    align: "start",
    gap: 4,
    edge: 8,
    contentKey: searchable ? `${options.length}:${query}` : options.length,
    dismissPointerEvent: "mousedown",
  });

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      if (opt.label.toLowerCase().includes(q)) return true;
      return Boolean(opt.group?.toLowerCase().includes(q));
    });
  }, [options, query]);

  const selected = useMemo(() => {
    const match = options.find((opt) => opt.value === value);
    if (match) return match;
    if (placeholder !== undefined) {
      return { value: value || "", label: placeholder };
    }
    if (options[0]) return options[0];
    return { value, label: value || "—" };
  }, [options, placeholder, value]);

  const closeAndSelect = (next: string, optionDisabled?: boolean) => {
    if (optionDisabled) return;
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

  const displayLabel = selected.label.trim() || "—";
  const showingPlaceholder =
    placeholder !== undefined && (!value || !options.some((opt) => opt.value === value));

  const shellClass = isField
    ? ["relative block w-full min-w-0 box-border", className ?? ""].filter(Boolean).join(" ")
    : isToolbar
      ? ["relative inline-flex w-auto shrink-0 min-w-0 box-border", className ?? ""]
          .filter(Boolean)
          .join(" ")
      : className;

  const listBoxStyle: CSSProperties | undefined = menuPortal
    ? {
        ...anchoredMenuPortalStyle(menuPos),
        ...listBoxChromeStyle,
      }
    : usesFormChrome
      ? {
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(100% + 4px)",
          zIndex: 30,
          width: "100%",
          minWidth: isToolbar ? "max-content" : 0,
          maxWidth: isToolbar ? "none" : "100%",
          ...listBoxChromeStyle,
        }
      : listStyle;

  // useAnchoredMenu owns open/dismiss even when not portaled; we only skip fixed placement.
  const listbox = open ? (
    <ul
      ref={menuPortal ? (menuRef as RefObject<HTMLUListElement>) : undefined}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className="im-menu-surface rounded-md border border-surface-border shadow-md"
      style={listBoxStyle}
      data-testid={testId ? `${testId}-list` : undefined}
    >
      {searchable ? (
        <li
          role="presentation"
          className="sticky top-0 z-[1] mb-0.5"
          style={listSurfaceStyle}
        >
          <input
            type="search"
            value={query}
            autoComplete="off"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid={testId ? `${testId}-search` : undefined}
            className={`${controlBaseClass} ${controlSizeClass.sm}`}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </li>
      ) : null}
      {filteredOptions.length === 0 ? (
        <li role="presentation">
          <div className="px-sm py-1.5 text-caption text-text-muted">
            {searchEmptyLabel || "—"}
          </div>
        </li>
      ) : (
        filteredOptions.flatMap((opt, index) => {
          const isActive = opt.value === selected.value && Boolean(value);
          const optionDisabled = Boolean(opt.disabled);
          const prev = filteredOptions[index - 1];
          const showGroup = Boolean(opt.group) && opt.group !== prev?.group;
          const optionTitle = opt.title?.trim() || opt.label;
          const nodes: ReactElement[] = [];
          if (showGroup && opt.group) {
            nodes.push(
              <li key={`group:${opt.group}:${index}`} role="presentation">
                <div className="px-sm pb-0.5 pt-1.5 text-[11px] font-medium text-text-muted">
                  {opt.group}
                </div>
              </li>,
            );
          }
          nodes.push(
            <li key={opt.value || `__empty-${index}`} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={isActive}
                aria-disabled={optionDisabled || undefined}
                disabled={optionDisabled}
                title={optionTitle}
                data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
                className={[
                  "rounded-sm border-none px-sm py-1.5 text-caption font-medium leading-snug hover:!transform-none active:!transform-none",
                  optionDisabled
                    ? "cursor-not-allowed bg-transparent text-text-muted opacity-70"
                    : isActive
                      ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-card))] text-text-primary"
                      : "bg-transparent text-text-primary hover:bg-[color-mix(in_srgb,var(--text-primary)_10%,var(--surface-card))]",
                ].join(" ")}
                style={optionStyle}
                onClick={() => closeAndSelect(opt.value, optionDisabled)}
              >
                {opt.label}
              </button>
            </li>,
          );
          return nodes;
        })
      )}
    </ul>
  ) : null;

  return (
    <div
      ref={rootRef as RefObject<HTMLDivElement>}
      className={shellClass}
      style={usesFormChrome ? undefined : shellStyle}
      data-testid={testId}
    >
      <button
        ref={anchorRef as RefObject<HTMLButtonElement>}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-required={ariaRequired || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId ? `${testId}-value` : undefined}
        title={displayLabel}
        className={
          usesFormChrome
            ? [
                isToolbar ? toolbarTriggerClass : fieldTriggerClass,
                "hover:!transform-none active:!transform-none",
                triggerClassName ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : "im-surface-inset rounded-md border border-surface-border px-sm py-1.5 text-caption font-medium leading-snug text-text-primary hover:!transform-none active:!transform-none disabled:cursor-not-allowed disabled:opacity-50"
        }
        style={isField ? fieldTriggerStyle : isToolbar ? toolbarTriggerStyle : triggerStyle}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span
          style={usesFormChrome ? fieldLabelStyle : labelStyle}
          className={showingPlaceholder ? "text-text-muted" : undefined}
        >
          {displayLabel}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          aria-hidden="true"
          className={`shrink-0 text-text-secondary transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {menuPortal && listbox && typeof document !== "undefined"
        ? createPortal(listbox, document.body)
        : listbox}
    </div>
  );
}
