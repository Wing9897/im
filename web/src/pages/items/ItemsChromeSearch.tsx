import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "../../components/ui";
import { itemsPageChromeSearchClass } from "./itemsPageChromeClasses";

export const ITEMS_SEARCH_DEBOUNCE_MS = 250;

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** i18n key under `items` for placeholder / aria (default search). */
  placeholderKey?: string;
  /** Optional aria-label key; defaults to placeholderKey. */
  ariaKey?: string;
  className?: string;
  "data-testid"?: string;
};

/**
 * Items sticky-chrome search: debounced commit, clear when non-empty,
 * Escape clears then blurs — matches desk-density top bar.
 */
export function ItemsChromeSearch({
  value,
  onChange,
  placeholderKey = "searchPlaceholder",
  ariaKey,
  className,
  "data-testid": dataTestId = "items-chrome-search",
}: Props) {
  const { t } = useTranslation("items");
  const [draft, setDraft] = useState(value);
  const wrapRef = useRef<HTMLDivElement>(null);
  const clearId = useId();

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (draft === value) return;
    const timer = window.setTimeout(() => {
      onChange(draft);
    }, ITEMS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onChange, value]);

  const inputEl = () =>
    wrapRef.current?.querySelector<HTMLInputElement>("input") ?? null;

  const commitImmediate = (next: string) => {
    setDraft(next);
    onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    if (draft) {
      event.preventDefault();
      commitImmediate("");
      return;
    }
    event.preventDefault();
    event.currentTarget.blur();
  };

  const placeholder = t(placeholderKey);
  const ariaLabel = t(ariaKey ?? placeholderKey);
  const fieldClass = [itemsPageChromeSearchClass, className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={wrapRef}
      className="relative min-w-[10rem] flex-1 basis-[10rem]"
      data-testid={dataTestId}
    >
      <Search
        size={14}
        strokeWidth={2.2}
        aria-hidden
        className="pointer-events-none absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-text-muted"
      />
      <TextField
        type="search"
        className={`${fieldClass} !pl-7 ${draft ? "!pr-7" : ""}`}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        aria-label={ariaLabel}
        aria-describedby={draft ? clearId : undefined}
        data-im-search
        data-testid={`${dataTestId}-input`}
      />
      {draft ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          id={clearId}
          className="absolute right-0.5 top-1/2 !min-h-6 !h-6 !w-6 -translate-y-1/2 !px-0 text-text-muted"
          onClick={() => {
            commitImmediate("");
            inputEl()?.focus();
          }}
          aria-label={t("searchClearAria")}
          title={t("searchClearAria")}
          data-testid={`${dataTestId}-clear`}
        >
          <X size={12} strokeWidth={2.4} aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
