import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarShareConnectionStatusIcon } from "../../domain/calendarShare/CalendarShareConnectionStatusIcon";
import { CardGrid, OpsControlBar, TextField } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  isCalendarShareNotFound,
  SUBSCRIBE_UNAVAILABLE_CLASS,
  type SubscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";

type ChromeProps = {
  status: SubscribePageStatus;
  error?: string | null;
  toolbar?: ReactNode;
  children: ReactNode;
};

/** Shared error chrome for Mine, Published, and Search (connection status lives in toolbars). */
export function SubscriptionsPageChrome({ status: _status, error, toolbar, children }: ChromeProps) {
  const errorMessage = error && !isCalendarShareNotFound(error) ? error : null;
  return (
    <div className="flex flex-col gap-sm">
      {errorMessage ? (
        <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
          {errorMessage}
        </p>
      ) : null}
      {toolbar}
      {children}
    </div>
  );
}

type ListToolbarProps = {
  value: string;
  onChange: (value: string) => void;
  testId: string;
  actions?: ReactNode;
  status?: SubscribePageStatus;
  loggedOutTitle?: string;
};

/** Client-side filter for already-listed Mine / Published cards. Always visible, including empty lists. */
export function SubscriptionsListToolbar({
  value,
  onChange,
  testId,
  actions,
  status,
  loggedOutTitle,
}: ListToolbarProps) {
  const { t } = useTranslation("subscriptions");
  return (
    <OpsControlBar
      ariaLabel={t("listFilter.aria")}
      data-testid={`${testId}-toolbar`}
      className="!mb-0 flex-wrap"
    >
      <div className="min-w-[10rem] flex-1">
        <TextField
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("listFilter.placeholder")}
          aria-label={t("listFilter.aria")}
          data-testid={testId}
        />
      </div>
      {(actions || (status && status !== "loading")) ? (
        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          {actions}
          {status && status !== "loading" ? (
            <CalendarShareConnectionStatusIcon
              availability={status}
              loggedOutTitle={loggedOutTitle ?? t("needLogin")}
            />
          ) : null}
        </div>
      ) : null}
    </OpsControlBar>
  );
}

type CardSectionProps = {
  status: SubscribePageStatus;
  loading?: boolean;
  hasItems: boolean;
  empty: ReactNode;
  emptyTestId: string;
  listTestId: string;
  density?: "compact" | "spacious" | "default";
  children: ReactNode;
};

/** Loading / empty / card grid with the Timeline subscribe unavailable gate. */
export function SubscriptionsCardSection({
  status,
  loading = false,
  hasItems,
  empty,
  emptyTestId,
  listTestId,
  density = "default",
  children,
}: CardSectionProps) {
  const { t } = useTranslation("common");
  if (loading || status === "loading") {
    return (
      <p className={`mb-0 ${formHelpClass}`} data-testid={`${listTestId}-loading`} role="status">
        {t("ui.loading")}
      </p>
    );
  }
  if (!hasItems) {
    return <div data-testid={emptyTestId}>{empty}</div>;
  }
  const unavailable = status === "loggedOut" || status === "offline";
  return (
    <div
      data-testid={listTestId}
      data-availability={status}
      className={unavailable ? SUBSCRIBE_UNAVAILABLE_CLASS : undefined}
    >
      <CardGrid density={density}>{children}</CardGrid>
    </div>
  );
}
