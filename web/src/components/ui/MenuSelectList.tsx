import type { CSSProperties, ReactElement, Ref, RefObject } from "react";
import { controlBaseClass, controlSizeClass } from "./controlStyles";
import type { MenuSelectOption } from "./useMenuSelectState";

export const listSurfaceStyle: CSSProperties = {
  background: "var(--surface-raised, var(--surface-card))",
  color: "var(--text-primary)",
};

export const listBoxChromeStyle: CSSProperties = {
  margin: 0,
  padding: 4,
  listStyle: "none",
  maxHeight: 280,
  overflowY: "auto",
  scrollbarGutter: "stable",
  boxSizing: "border-box",
  ...listSurfaceStyle,
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

type Props = {
  listId: string;
  menuRef?: RefObject<HTMLUListElement | null>;
  ariaLabel?: string;
  testId?: string;
  listBoxStyle: CSSProperties;
  searchable: boolean;
  query: string;
  searchPlaceholder?: string;
  searchEmptyLabel?: string;
  onQueryChange: (value: string) => void;
  filteredOptions: readonly MenuSelectOption[];
  selectedValue: string;
  value: string;
  onSelect: (next: string, optionDisabled?: boolean) => void;
};

export function MenuSelectList({
  listId,
  menuRef,
  ariaLabel,
  testId,
  listBoxStyle,
  searchable,
  query,
  searchPlaceholder,
  searchEmptyLabel,
  onQueryChange,
  filteredOptions,
  selectedValue,
  value,
  onSelect,
}: Props) {
  return (
    <ul
      ref={menuRef as Ref<HTMLUListElement>}
      id={listId}
      role="listbox"
      aria-label={ariaLabel}
      className="im-menu-surface rounded-md border border-surface-border shadow-md"
      style={listBoxStyle}
      data-testid={testId ? `${testId}-list` : undefined}
    >
      {searchable ? (
        <li role="presentation" className="sticky top-0 z-[1] mb-0.5" style={listSurfaceStyle}>
          <input
            type="search"
            value={query}
            autoComplete="off"
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            data-testid={testId ? `${testId}-search` : undefined}
            className={`${controlBaseClass} ${controlSizeClass.sm}`}
            onChange={(event) => onQueryChange(event.target.value)}
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
          const isActive = opt.value === selectedValue && Boolean(value);
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
                onClick={() => onSelect(opt.value, optionDisabled)}
              >
                {opt.label}
              </button>
            </li>,
          );
          return nodes;
        })
      )}
    </ul>
  );
}
