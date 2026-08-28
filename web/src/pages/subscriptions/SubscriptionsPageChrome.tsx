import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertBanner, CardGrid, OpsControlBar, TextField } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import {
  isCalendarShareNotFound,
  SUBSCRIBE_UNAVAILABLE_CLASS,
  type SubscribePageStatus,
} from "../../domain/calendarShare/subscribedCalendars";

type ChromeProps = {
  status: SubscribePageStatus;
  error?: string | null;
  loginMessage?: string;
  toolbar?: ReactNode;
  children: ReactNode;
};

/** Shared login / offline / error chrome for Mine, Published, and Search. */
export function SubscriptionsPageChrome({
  status,
  error,
  loginMessage,
  toolbar,
  children,
}: ChromeProps) {
  const { t } = useTranslation("subscriptions");
  const errorMessage = error && !isCalendarShareNotFound(error) ? error : null;
  const showStatus = status === "loggedOut" || status === "offline" || Boolean(errorMessage);
  return (
    <div className="flex flex-col gap-sm">
      {showStatus ? (
        <div className="flex flex-col gap-sm">
          {status === "loggedOut" ? (
            <AlertBanner variant="warning" role="status" className="mb-0 max-w-[56ch]" data-testid="subscriptions-need-login">
              {loginMessage ?? t("needLogin")}{" "}
              <Link to="/subscriptions/account" className="font-medium text-accent no-underline hover:underline">
                {t("loginLink")}
              </Link>
            </AlertBanner>
          ) : null}
          {status === "offline" ? (
            <AlertBanner variant="warning" role="status" className="mb-0 max-w-[56ch]">
              {t("filter.offline")}
            </AlertBanner>
          ) : null}
          {errorMessage ? (
            <p className={`mb-0 ${formHelpClass} text-error`} role="alert">
              {errorMessage}
            </p>
          ) : null}
        </div>
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
};

/** Client-side filter for already-listed Mine / Published cards. Always visible, including empty lists. */
export function SubscriptionsListToolbar({
  value,
  onChange,
  testId,
  actions,
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
      {actions}
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
