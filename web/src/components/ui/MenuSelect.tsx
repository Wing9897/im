import type { CSSProperties, RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { anchoredMenuPortalStyle } from "../../hooks/useAnchoredMenu";
import { controlBaseClass, controlSizeClass } from "./controlStyles";
import { listBoxChromeStyle, MenuSelectList } from "./MenuSelectList";
import { useMenuSelectState, type MenuSelectOption } from "./useMenuSelectState";

export type { MenuSelectOption };

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

const defaultListStyle: CSSProperties = {
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

/**
 * Custom button + listbox select for **toolbar / chrome / ops bars**, and for dense
 * form rows that are a plain options list (prefer `variant="field"`).
 *
 * Disabled options, group headers, and in-menu search are supported here.
 * Prefer {@link SelectField} only when native `<select>` form-submit quirks are required.
 * Use `menuPortal` to escape overflow clipping; portaled menus also flip above
 * the trigger when there is no room below (map LIVE window, bottom chrome).
 * Shared placement lives in `useAnchoredMenu`.
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
  const {
    listId,
    query,
    setQuery,
    open,
    setOpen,
    menuPos,
    anchorRef,
    menuRef,
    rootRef,
    filteredOptions,
    selected,
    closeAndSelect,
    onTriggerKeyDown,
    displayLabel,
    showingPlaceholder,
  } = useMenuSelectState({
    id,
    value,
    options,
    onChange,
    placeholder,
    searchable,
    disabled,
    menuPortal,
  });

  const shellClass = isField
    ? ["relative block w-full min-w-0 box-border", className ?? ""].filter(Boolean).join(" ")
    : isToolbar
      ? ["relative inline-flex w-auto shrink-0 min-w-0 box-border", className ?? ""]
          .filter(Boolean)
          .join(" ")
      : className;

  const listBoxStyle: CSSProperties = menuPortal
    ? {
        ...anchoredMenuPortalStyle(menuPos),
        ...listBoxChromeStyle,
        ...(menuPos?.maxHeight != null ? { maxHeight: menuPos.maxHeight } : {}),
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
      : defaultListStyle;

  const listbox = open ? (
    <MenuSelectList
      listId={listId}
      menuRef={menuPortal ? (menuRef as RefObject<HTMLUListElement | null>) : undefined}
      ariaLabel={ariaLabel}
      testId={testId}
      listBoxStyle={listBoxStyle}
      searchable={searchable}
      query={query}
      searchPlaceholder={searchPlaceholder}
      searchEmptyLabel={searchEmptyLabel}
      onQueryChange={setQuery}
      filteredOptions={filteredOptions}
      selectedValue={selected.value}
      value={value}
      onSelect={closeAndSelect}
    />
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
