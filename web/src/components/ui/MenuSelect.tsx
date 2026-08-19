import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useAnchoredMenu } from "../../hooks/useAnchoredMenu";
import { controlBaseClass, controlSizeClass } from "./controlStyles";

export type MenuSelectOption = {
  value: string;
  label: string;
  /** Shown in the list but not selectable. */
  disabled?: boolean;
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
 * Custom button + listbox select for **toolbar / chrome / ops bars**, and for dense
 * form rows that are a plain options list (prefer `variant="field"`).
 *
 * Prefer {@link SelectField} only when native `<select>` is required (optgroup,
 * disabled options, form-submit quirks). Use `menuPortal` to escape overflow
 * clipping. Shared placement lives in `useAnchoredMenu`.
 *
 * Progressive: do not big-bang rewrite SelectField forms that still need native semantics.
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
  const { open, setOpen, menuPos, anchorRef, menuRef, rootRef } = useAnchoredMenu({
    enabled: !disabled,
    align: "start",
    gap: 4,
    edge: 8,
    contentKey: options.length,
    dismissPointerEvent: "mousedown",
  });

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
        position: "fixed",
        top: menuPos?.top ?? -9999,
        left: menuPos?.left ?? -9999,
        width: menuPos?.width ?? undefined,
        minWidth: menuPos?.width ?? undefined,
        zIndex: 3000,
        margin: 0,
        padding: 4,
        listStyle: "none",
        maxHeight: 280,
        overflowY: "auto",
        boxSizing: "border-box",
        visibility: menuPos ? "visible" : "hidden",
      }
    : usesFormChrome
      ? {
          position: "absolute",
          left: 0,
          right: 0,
          top: "calc(100% + 4px)",
          zIndex: 30,
          margin: 0,
          padding: 4,
          listStyle: "none",
          width: "100%",
          minWidth: isToolbar ? "max-content" : 0,
          maxWidth: isToolbar ? "none" : "100%",
          maxHeight: 280,
          overflowY: "auto",
          boxSizing: "border-box",
        }
      : listStyle;

  // Non-portal menus still need outside/Escape dismiss; portal placement is skipped when menuPortal is false.
  // useAnchoredMenu still owns open + dismiss; we only skip fixed positioning when not portaled.
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
      {options.map((opt) => {
        const isActive = opt.value === selected.value && Boolean(value);
        const optionDisabled = Boolean(opt.disabled);
        return (
          <li key={opt.value} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={isActive}
              aria-disabled={optionDisabled || undefined}
              disabled={optionDisabled}
              title={opt.label}
              data-testid={testId ? `${testId}-option-${opt.value}` : undefined}
              className={[
                "rounded-sm border-none px-sm py-1.5 text-caption leading-snug",
                optionDisabled
                  ? "cursor-not-allowed bg-transparent text-text-muted opacity-70"
                  : isActive
                    ? "bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-card))] font-medium text-accent"
                    : "bg-transparent text-text-primary hover:bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-card))]",
              ].join(" ")}
              style={optionStyle}
              onClick={() => closeAndSelect(opt.value, optionDisabled)}
            >
              {opt.label}
            </button>
          </li>
        );
      })}
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
                triggerClassName ?? "",
              ]
                .filter(Boolean)
                .join(" ")
            : "im-surface-inset rounded-md border border-surface-border px-sm py-1.5 text-caption font-medium leading-snug text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
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
