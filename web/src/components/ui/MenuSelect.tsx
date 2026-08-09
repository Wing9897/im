import type { CSSProperties, KeyboardEvent, RefObject } from "react";
import { useId, useMemo } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useAnchoredMenu } from "../../hooks/useAnchoredMenu";
import { controlBaseClass, controlSizeClass } from "./controlStyles";

export type MenuSelectOption = {
  value: string;
  label: string;
};

type MenuSelectVariant = "default" | "field";

type MenuSelectProps = {
  id?: string;
  value: string;
  options: readonly MenuSelectOption[];
  onChange: (value: string) => void;
  className?: string;
  /** Extra classes on the field-variant trigger button (e.g. toolbar density). */
  triggerClassName?: string;
  /** Full-width form control — matches SelectField chrome (no native `<select>`). */
  variant?: MenuSelectVariant;
  /** Portal the listbox to `document.body` so overflow ancestors cannot clip it. */
  menuPortal?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
  disabled?: boolean;
};

const fieldTriggerClass = `${controlBaseClass} ${controlSizeClass.md} cursor-pointer text-left disabled:cursor-not-allowed`;

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
 * Custom button + listbox select for **toolbar / chrome** (Items sort, filters, etc.).
 *
 * Prefer {@link SelectField} for dense form rows (native `<select>` + closed-label overlay).
 * Use `MenuSelect` when you need a non-native listbox, CJK-safe closed labels, or
 * `menuPortal` to escape overflow clipping. Shared placement lives in `useAnchoredMenu`.
 *
 * Progressive: do not big-bang rewrite existing SelectField forms.
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
  disabled = false,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: MenuSelectProps) {
  const isField = variant === "field";
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
    if (options[0]) return options[0];
    return { value, label: value || "—" };
  }, [options, value]);

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

  const displayLabel = selected.label.trim() || "—";

  const shellClass = isField
    ? ["relative block w-full min-w-0 box-border", className ?? ""].filter(Boolean).join(" ")
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
    : isField
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
          minWidth: 0,
          maxWidth: "100%",
          maxHeight: 280,
          overflowY: "auto",
          boxSizing: "border-box",
        }
      : listStyle;

  // Non-portal menus still need outside/Escape dismiss; portal placement is skipped when menuPortal is false.
  // useAnchoredMenu still owns open + dismiss; we only skip fixed positioning when not portaled.
  const listbox = open ? (
    <ul
      ref={menuPortal ? (menuRef as RefObject<HTMLUListElement | null>) : undefined}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className="im-menu-surface rounded-md border border-surface-border bg-surface-card shadow-md"
      style={listBoxStyle}
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
  ) : null;

  return (
    <div
      ref={rootRef as RefObject<HTMLDivElement | null>}
      className={shellClass}
      style={isField ? undefined : shellStyle}
      data-testid={testId}
    >
      <button
        ref={anchorRef as RefObject<HTMLButtonElement | null>}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-testid={testId ? `${testId}-value` : undefined}
        title={displayLabel}
        className={
          isField
            ? [fieldTriggerClass, triggerClassName ?? ""].filter(Boolean).join(" ")
            : "rounded-md border border-surface-border bg-surface-card px-sm py-1.5 text-caption font-medium leading-snug text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
        }
        style={isField ? fieldTriggerStyle : triggerStyle}
        onClick={() => {
          if (!disabled) setOpen(!open);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span style={isField ? fieldLabelStyle : labelStyle}>{displayLabel}</span>
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
