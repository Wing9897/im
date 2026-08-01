import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "../../components/ModalDialog";
import { Button, PillButton, TextField } from "../../components/ui";
import { usePersistedState } from "../../hooks/usePersistedState";
import { INTELLIGENCE_SEARCH_FILTER_OPEN_STORAGE_KEY } from "../../domain/prefs";

type IntelligenceSearchFilterControlProps = {
  search: string;
  setSearch: (value: string) => void;
};

/**
 * Toolbar trigger + modal for the intelligence text search field.
 * Source multi-select stays on the toolbar (SourceFilterDialog).
 */
export function IntelligenceSearchFilterControl({
  search,
  setSearch,
}: IntelligenceSearchFilterControlProps) {
  const { t } = useTranslation("intelligence");
  const [open, setOpen] = usePersistedState(
    INTELLIGENCE_SEARCH_FILTER_OPEN_STORAGE_KEY,
    false,
  );
  const [announcement, setAnnouncement] = useState("");
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasActiveSearch = search.trim() !== "";

  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string) => {
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current);
    }
    setAnnouncement("");
    announcementTimeoutRef.current = setTimeout(() => {
      setAnnouncement(message);
    }, 50);
  }, []);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setSearch(value);
      announce(
        value
          ? t("filter.announceSearch", { value })
          : t("filter.announceSearchCleared"),
      );
    },
    [announce, setSearch, t],
  );

  const clearSearch = useCallback(() => {
    setSearch("");
    announce(t("filter.announceSearchCleared"));
  }, [announce, setSearch, t]);

  return (
    <>
      <PillButton
        active={open || hasActiveSearch}
        aria-expanded={open}
        aria-label={t("filter.openAria")}
        title={t("filter.openAria")}
        onClick={() => setOpen(true)}
        className="relative"
        data-testid="intelligence-search-filter-button"
      >
        <Search size={16} strokeWidth={2.5} aria-hidden="true" />
        {hasActiveSearch ? (
          <span
            className="absolute right-1 top-1 size-1.5 rounded-full bg-accent"
            aria-hidden="true"
          />
        ) : null}
      </PillButton>

      <ModalDialog
        open={open}
        title={t("filter.title")}
        closeAriaLabel={t("filter.closeAria")}
        onClose={() => setOpen(false)}
        testId="intelligence-search-filter-dialog"
        footerJustify={hasActiveSearch ? "space-between" : "flex-end"}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={!hasActiveSearch}
              onClick={clearSearch}
              aria-label={t("filter.clearAria")}
            >
              {t("filter.clear")}
            </Button>
            <Button type="button" variant="primary" onClick={() => setOpen(false)}>
              {t("filter.done")}
            </Button>
          </>
        }
      >
        <TextField
          type="text"
          aria-label={t("toolbar.searchAria")}
          placeholder={t("toolbar.searchPlaceholder")}
          value={search}
          onChange={handleSearchChange}
          maxLength={200}
          autoFocus
          data-im-search
          data-testid="intelligence-search-filter-input"
        />
      </ModalDialog>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
