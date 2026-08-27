/**
 * Subscribed-calendar column inside TimelineSourceFilterDialog.
 * Section identity is a Bookmark icon (localized name is aria/title only),
 * not a tri-state parent competing with local worksets.
 * Each handle/slug is a top-level row (same chrome as a workset). Catalog stays
 * outside SourceFilterSelection.
 */

import { Bookmark, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { SourceFilterColumnActions, SourceFilterSectionHeading } from "./SourceFilterTree";
import type { SubscribeAvailability, SubscribedCalendarSelection } from "../domain/calendarShare/subscribedCalendars";

export type SubscribeCalendarOption = {
  key: string;
  label: string;
};

type Props = {
  calendars: readonly SubscribeCalendarOption[];
  draft: SubscribedCalendarSelection;
  query: string;
  onToggleKey: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  availability?: SubscribeAvailability;
};

const ROW_CHROME =
  "overflow-hidden rounded-md border outline-none im-surface-inset border-[color-mix(in_srgb,var(--text-primary)_26%,var(--surface-border))]";

/** Section of handle/slug rows; the pane stays mounted when search matches nothing. */
export function SubscribeFilterGroup({
  calendars,
  draft,
  query,
  onToggleKey,
  onSelectAll,
  onClearAll,
  availability = "ok",
}: Props) {
  const { t } = useTranslation("subscriptions");
  const needle = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!needle) return calendars;
    return calendars.filter(
      (row) => row.label.toLowerCase().includes(needle) || row.key.toLowerCase().includes(needle),
    );
  }, [calendars, needle]);
  const searching = Boolean(needle);
  const heading = t("filter.title");
  const disabled = availability !== "ok";
  const statusCopy =
    availability === "loggedOut"
      ? t("filter.loggedOut")
      : availability === "offline"
        ? t("filter.offline")
        : searching
          ? t("search.noResults")
          : t("filter.empty");

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-sm overflow-hidden"
      data-testid="timeline-subscribe-filter"
      data-availability={availability}
      aria-label={heading}
      aria-disabled={disabled || undefined}
    >
      <SourceFilterSectionHeading
        icon={Bookmark}
        label={heading}
        testId="timeline-filter-section-subscribe"
      />
      {disabled ? (
        <p className="m-0 px-1 text-caption text-text-muted" data-testid="timeline-subscribe-disabled">
          {statusCopy}{" "}
          {availability === "loggedOut" ? (
            <Link
              to="/account/identity"
              className="font-medium text-accent no-underline hover:underline"
            >
              {t("loginLink")}
            </Link>
          ) : null}
        </p>
      ) : null}
      <div className={disabled ? "pointer-events-none opacity-50" : undefined}>
        <SourceFilterColumnActions
          selectLabel={t("filter.selectAll")}
          clearLabel={t("filter.clearAll")}
          selectAria={t("filter.selectAllSubscribeAria")}
          clearAria={t("filter.clearSubscribeAria")}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          selectTestId="timeline-filter-subscribe-select-all"
          clearTestId="timeline-filter-subscribe-clear"
          disabled={disabled}
        />
      </div>
      <div
        className={`im-auto-scrollbar min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]${
          disabled ? " pointer-events-none opacity-50" : ""
        }`}
        data-testid="timeline-filter-subscribe-scroll"
      >
        {visible.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={t("filter.browseAria")}>
            {visible.map((row) => {
              const checked = draft === null || draft.includes(row.key);
              return (
                <li key={row.key} className={ROW_CHROME}>
                  <div className="flex items-center gap-1 px-1.5 py-1.5">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center" aria-hidden="true">
                      <ChevronRight size={16} strokeWidth={2.5} className="invisible" />
                    </span>
                    <label className={`flex min-w-0 flex-1 items-center gap-sm pr-sm${disabled ? "" : " cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        data-testid={`timeline-subscribe-toggle-${row.key}`}
                        onChange={() => onToggleKey(row.key)}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                        {row.label}
                      </span>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : disabled ? null : (
          <p className="m-0 px-1 text-caption text-text-secondary" data-testid="timeline-subscribe-empty">
            {statusCopy}
          </p>
        )}
      </div>
    </section>
  );
}
