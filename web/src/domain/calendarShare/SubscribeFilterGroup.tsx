import { Bookmark } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import {
  SourceFilterColumnShell,
  SourceFilterColumnActions,
  SourceFilterSectionHeading,
} from "../../components/SourceFilterTree";
import { IdentityAvatar } from "../user/IdentityAvatarView";
import {
  SUBSCRIBE_UNAVAILABLE_CLASS,
  matchesCalendarShareFilter,
  type SubscribeAvailability,
  type SubscribeCalendarIdentity,
  type SubscribedCalendarSelection,
} from "./subscribedCalendars";

export type SubscribeCalendarOption = SubscribeCalendarIdentity;

type Props = {
  calendars: readonly SubscribeCalendarOption[];
  draft: SubscribedCalendarSelection;
  query: string;
  onToggleKey: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  availability?: SubscribeAvailability;
  /** `compact` stacks in a single dialog; `column` is the Timeline dual-column shell. */
  variant?: "column" | "compact";
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
  variant = "column",
}: Props) {
  const { t } = useTranslation("subscriptions");
  const visible = useMemo(() => {
    return calendars.filter((row) =>
      matchesCalendarShareFilter(
        query,
        row.label,
        row.key,
        row.handle,
        row.slug,
      ),
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

  const list =
    visible.length > 0 ? (
      <ul
        className="m-0 flex list-none flex-col gap-1.5 p-0"
        aria-label={t("filter.browseAria")}
      >
        {visible.map((row) => {
          const checked = draft === null || draft.includes(row.key);
          return (
            <li key={row.key} className={ROW_CHROME}>
              <div className="flex items-center gap-1 px-1.5 py-1.5">
                <span
                  className="inline-flex shrink-0 items-center justify-center"
                  aria-hidden="true"
                  data-testid={`timeline-subscribe-avatar-${row.key}`}
                >
                  <IdentityAvatar
                    label={row.handle}
                    src={row.ownerAvatar}
                    size="sm"
                    testId={`timeline-subscribe-avatar-mark-${row.key}`}
                  />
                </span>
                <label
                  className={`flex min-w-0 flex-1 items-center gap-sm pr-sm${disabled ? "" : " cursor-pointer"}`}
                >
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
      <p
        className="m-0 px-1 text-caption text-text-secondary"
        data-testid="timeline-subscribe-empty"
      >
        {statusCopy}
      </p>
    );

  if (variant === "compact") {
    return (
      <section
        className="flex min-h-0 flex-col gap-sm border-t border-[color-mix(in_srgb,var(--text-primary)_20%,var(--surface-border))] pt-md"
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
          <p
            className="m-0 px-1 text-caption text-text-muted"
            data-testid="timeline-subscribe-disabled"
          >
            {statusCopy}{" "}
            {availability === "loggedOut" ? (
              <Link
                to="/subscriptions/account"
                className="font-medium text-accent no-underline hover:underline"
              >
                {t("loginLink")}
              </Link>
            ) : null}
          </p>
        ) : null}
        <div className={disabled ? SUBSCRIBE_UNAVAILABLE_CLASS : undefined}>
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
          className={
            disabled
              ? `im-auto-scrollbar max-h-[28vh] overflow-y-auto [scrollbar-gutter:stable] ${SUBSCRIBE_UNAVAILABLE_CLASS}`
              : "im-auto-scrollbar max-h-[28vh] overflow-y-auto [scrollbar-gutter:stable]"
          }
          data-testid="timeline-filter-subscribe-scroll"
        >
          {list}
        </div>
      </section>
    );
  }

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
          <p
            className="m-0 px-1 text-caption text-text-muted"
            data-testid="timeline-subscribe-disabled"
          >
            {statusCopy}{" "}
            {availability === "loggedOut" ? (
              <Link
                to="/subscriptions/account"
                className="font-medium text-accent no-underline hover:underline"
              >
                {t("loginLink")}
              </Link>
            ) : null}
          </p>
        ) : null
      }
    >
      {list}
    </SourceFilterColumnShell>
  );
}
