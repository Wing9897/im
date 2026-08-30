import { Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PillButton } from "../ui/PillButton";
import type { SubscribeAvailability } from "../../domain/calendarShare/subscribedCalendars";
import { colorStatusDotStyle } from "../../styles/statusDot";

export const CALENDAR_SHARE_ACCOUNT_PATH = "/subscriptions/account";

type CalendarShareConnectionStatusIconProps = {
  availability: SubscribeAvailability;
  /** Subscriptions pages use needLogin / published.needLogin instead of filter.loggedOut. */
  loggedOutTitle?: string;
  className?: string;
};

function statusDotColor(availability: SubscribeAvailability): string {
  if (availability === "ok") return "var(--success)";
  if (availability === "offline") return "var(--error)";
  return "var(--warning)";
}

export function calendarShareConnectionTitle(
  availability: SubscribeAvailability,
  translate: (key: string) => string,
  loggedOutTitle?: string,
): string {
  if (availability === "ok") return translate("connectionIcon.ok");
  if (availability === "offline") return translate("filter.offline");
  return loggedOutTitle ?? translate("filter.loggedOut");
}

/** Compact calendar-share gate for toolbars — click opens the account tab. */
export function CalendarShareConnectionStatusIcon({
  availability,
  loggedOutTitle,
  className,
}: CalendarShareConnectionStatusIconProps) {
  const { t } = useTranslation("subscriptions");
  const navigate = useNavigate();
  const detail = calendarShareConnectionTitle(availability, t, loggedOutTitle);
  const hint = t("connectionIcon.openAccount");
  const label = `${detail} ${hint}`;

  return (
    <PillButton
      type="button"
      padding="square"
      className={`relative size-8 shrink-0 p-0 ${className ?? ""}`}
      title={label}
      aria-label={label}
      data-testid="calendar-share-connection-status"
      data-availability={availability}
      onClick={() => navigate(CALENDAR_SHARE_ACCOUNT_PATH)}
    >
      <Share2 size={16} strokeWidth={2.5} aria-hidden="true" />
      <span
        className="absolute bottom-0.5 right-0.5"
        style={colorStatusDotStyle(statusDotColor(availability))}
        aria-hidden="true"
      />
    </PillButton>
  );
}
