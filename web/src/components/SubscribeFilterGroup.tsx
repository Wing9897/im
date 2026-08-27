/**
 * Subscribed-calendar column inside TimelineSourceFilterDialog.
 * Section identity is a Bookmark icon (localized name is aria/title only),
 * not a tri-state parent competing with local worksets.
 * Each handle/slug is a top-level row (same chrome as a workset). Catalog stays
 * outside SourceFilterSelection. Row identity comes from
 * `subscribeCalendarIdentity` so filter rows match subscription cards.
 */

import { Bookmark } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { SourceFilterColumnShell } from "./SourceFilterTree";
import { TaskLogoMark, TASK_LOGO_BADGE_PX } from "./task/TaskLogoMark";
import {
  SUBSCRIBE_UNAVAILABLE_CLASS,
  matchesCalendarShareFilter,
  type SubscribeAvailability,
  type SubscribeCalendarIdentity,
  type SubscribedCalendarSelection,
} from "../domain/calendarShare/subscribedCalendars";

export type SubscribeCalendarOption = SubscribeCalendarIdentity;

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
  const visible = useMemo(() => {
    return calendars.filter((row) =>
      matchesCalendarShareFilter(query, row.label, row.key, row.handle, row.slug),
    );
  }, [calendars, query]);
  const searching = Boolean(query.trim());
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
    <SourceFilterColumnShell
      icon={Bookmark}
      label={heading}
      headingTestId="timeline-filter-section-subscribe"
      sectionTestId="timeline-subscribe-filter"
      scrollTestId="timeline-filter-subscribe-scroll"
      selectLabel={t("filter.selectAll")}
      clearLabel={t("filter.clearAll")}
      selectAria={t("filter.selectAllSubscribeAria")}
      clearAria={t("filter.clearSubscribeAria")}
      onSelectAll={onSelectAll}
      onClearAll={onClearAll}
      selectTestId="timeline-filter-subscribe-select-all"
      clearTestId="timeline-filter-subscribe-clear"
      disabled={disabled}
      actionsClassName={disabled ? SUBSCRIBE_UNAVAILABLE_CLASS : undefined}
      scrollClassName={disabled ? SUBSCRIBE_UNAVAILABLE_CLASS : undefined}
      dataAvailability={availability}
      beforeActions={
        disabled ? (
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
        ) : null
      }
    >
      {visible.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label={t("filter.browseAria")}>
          {visible.map((row) => {
            const checked = draft === null || draft.includes(row.key);
            return (
              <li key={row.key} className={ROW_CHROME}>
                <div className="flex items-center gap-1 px-1.5 py-1.5">
                  <span
                    className="inline-flex size-7 shrink-0 items-center justify-center"
                    aria-hidden="true"
                    data-testid={`timeline-subscribe-emoji-${row.key}`}
                  >
                    <TaskLogoMark emoji={row.emoji} sizePx={TASK_LOGO_BADGE_PX} />
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
    </SourceFilterColumnShell>
  );
}
