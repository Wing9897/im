import type { LucideIcon } from "lucide-react";
import { CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import {
  AccentBarCard,
  type BadgeTone,
} from "../../components/ui";
import { TaskLogoMark } from "../../components/task/TaskLogoMark";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import {
  type CalendarShareGrantVisibility,
  type CalendarShareListingVisibility,
} from "../../domain/calendarShare/listingVisibility";

const AVATAR_PX = 48;

export function visibilityAccentClass(
  visibility: CalendarShareListingVisibility | CalendarShareGrantVisibility,
): string {
  if (visibility === "public" || visibility === "details") return "bg-accent";
  if (visibility === "public_busy" || visibility === "busy") return "bg-warning";
  return "bg-[var(--text-muted)]";
}

export function visibilityBadgeTone(
  visibility: CalendarShareListingVisibility | CalendarShareGrantVisibility,
): BadgeTone {
  if (visibility === "public" || visibility === "details") return "accent";
  if (visibility === "public_busy" || visibility === "busy") return "warning";
  return "neutral";
}

type Props = {
  title: string;
  /** Remote / workset emoji; empty uses the Lucide fallback. */
  emoji?: string;
  /** Truncated when present. */
  description?: string;
  icon?: LucideIcon;
  accentClass?: string;
  badge?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  "data-testid"?: string;
  className?: string;
};

/** Entity card for subscription lists — 48px emoji avatar, same chrome as workset cards. */
export function SubscriptionCalendarCard({
  title,
  emoji = "",
  description = "",
  icon = CalendarDays,
  accentClass = "bg-accent",
  badge,
  children,
  actions,
  "data-testid": dataTestId,
  className,
}: Props) {
  const blurb = description.trim();
  return (
    <AccentBarCard
      accentClass={accentClass}
      enter="rise"
      data-testid={dataTestId}
      className={className}
    >
      <div className="flex items-start gap-md">
        <TaskLogoMark
          emoji={emoji}
          sizePx={AVATAR_PX}
          fallbackIcon={icon}
          testId="subscription-card-emoji"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-sm">
          <div className="flex min-w-0 items-start justify-between gap-sm">
            <span className={`min-w-0 truncate ${cardTitleClass}`} title={title}>
              {title}
            </span>
            {badge}
          </div>
          {blurb ? (
            <p className={`m-0 line-clamp-2 ${cardBodyClass}`} title={blurb} data-testid="subscription-card-description">
              {blurb}
            </p>
          ) : null}
          {children ? <div className={cardBodyClass}>{children}</div> : null}
          {actions ? (
            <div className="mt-auto flex min-h-7 flex-nowrap items-center gap-sm overflow-x-auto pt-xs [scrollbar-gutter:stable] [&>*]:shrink-0">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </AccentBarCard>
  );
}
