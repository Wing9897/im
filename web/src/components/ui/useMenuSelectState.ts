import type { KeyboardEvent } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import { useAnchoredMenu } from "../../hooks/useAnchoredMenu";
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

type Args = {
  id?: string;
  value: string;
  options: readonly MenuSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchable: boolean;
  disabled: boolean;
  menuPortal: boolean;
};

export function useMenuSelectState({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchable,
  disabled,
  menuPortal,
}: Args) {
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const [query, setQuery] = useState("");
  const { open, setOpen, menuPos, anchorRef, menuRef, rootRef } = useAnchoredMenu({
    enabled: !disabled,
    align: "start",
    gap: 4,
    edge: 8,
    flip: menuPortal,
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

  return {
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
  };
}
