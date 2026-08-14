import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../../api/userEvents";
import { Badge } from "../../../components/ui";
import {
  isExpiresCalendarEvent,
  isPurchaseEffectiveCalendarEvent,
} from "../../../domain/timeline/userEventCalendarKind";

/** Kind badges for a one-off linked calendar chip (expiry / primary / purchase / finance direction). */
export function LinkedCalendarKindBadges({
  event,
  primaryExpiryId,
  markPrimaryExpiry,
}: {
  event: UserEvent;
  primaryExpiryId: string | null;
  markPrimaryExpiry: boolean;
}) {
  const { t } = useTranslation("items");
  const badges: ReactNode[] = [];

  if (isExpiresCalendarEvent(event)) {
    badges.push(
      <Badge
        key="expires"
        tone="warning"
        className="max-w-full truncate normal-case tracking-normal"
        data-testid="item-linked-calendar-badge-expires"
      >
        {t("linkedCalendarBadge.expires")}
      </Badge>,
    );
    if (markPrimaryExpiry && primaryExpiryId != null && event.id === primaryExpiryId) {
      badges.push(
        <Badge
          key="primary"
          tone="accent"
          className="max-w-full truncate normal-case tracking-normal"
          data-testid="item-linked-calendar-badge-primary"
        >
          {t("linkedCalendarBadge.primary")}
        </Badge>,
      );
    }
  }

  if (isPurchaseEffectiveCalendarEvent(event)) {
    badges.push(
      <Badge
        key="purchase"
        tone="info"
        className="max-w-full truncate normal-case tracking-normal"
        data-testid="item-linked-calendar-badge-purchase-effective"
      >
        {t("linkedCalendarBadge.purchaseEffective")}
      </Badge>,
    );
    const direction = event.direction === "income" ? "income" : "expense";
    badges.push(
      <Badge
        key="finance"
        tone={direction === "income" ? "success" : "neutral"}
        className="max-w-full truncate normal-case tracking-normal"
        data-testid={`item-linked-calendar-badge-${direction}`}
      >
        {t(`finance.direction.${direction}`)}
      </Badge>,
    );
  }

  if (badges.length === 0) return null;
  return <span className="flex max-w-full flex-wrap justify-center gap-0.5">{badges}</span>;
}
