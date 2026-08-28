import type { ReactNode } from "react";
import {
  AccentBarCard,
  type BadgeTone,
} from "../../components/ui";
import { IdentityAvatar } from "../../components/user/IdentityAvatar";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import {
  type CalendarShareGrantVisibility,
  type CalendarShareListingVisibility,
} from "../../domain/calendarShare/listingVisibility";
import { resolveWorksetCoverSrc } from "../../domain/worksets/worksetCover";

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
  /** Publisher handle for initials when ``ownerAvatar`` is empty. */
  ownerLabel?: string;
  ownerAvatar?: string;
  cover?: string;
  /** Truncated when present. */
  description?: string;
  accentClass?: string;
  badge?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  "data-testid"?: string;
  className?: string;
};

/** Subscription list card — publisher avatar + calendar cover + handle/slug path. */
export function SubscriptionCalendarCard({
  title,
  ownerLabel = title,
  ownerAvatar = "",
  cover = "",
  description = "",
  accentClass = "bg-accent",
  badge,
  children,
  actions,
  "data-testid": dataTestId,
  className,
}: Props) {
  const blurb = description.trim();
  const coverSrc = resolveWorksetCoverSrc(cover);
  const avatarLabel = ownerLabel.trim() || title;
  return (
    <AccentBarCard
      accentClass={accentClass}
      enter="rise"
      data-testid={dataTestId}
      className={className}
    >
      <div className="flex flex-col gap-md">
        <div
          className="relative aspect-[2.4/1] w-full overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--surface-border)_40%,transparent)]"
          data-testid="subscription-card-cover"
        >
          <img
            src={coverSrc}
            alt=""
            className="h-full w-full border-0 object-cover"
            data-testid="subscription-card-cover-preview"
            draggable={false}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-sm">
          <div className="flex min-w-0 items-start gap-sm">
            <IdentityAvatar
              label={avatarLabel}
              src={ownerAvatar}
              size="md"
              testId="subscription-card-avatar"
            />
            <div className="min-w-0 flex-1 flex-col gap-xs">
              <div className="flex min-w-0 items-start justify-between gap-sm">
                <span className={`min-w-0 truncate ${cardTitleClass}`} title={title}>
                  {title}
                </span>
                {badge}
              </div>
            </div>
          </div>
          {blurb ? (
            <p
              className={`m-0 line-clamp-2 ${cardBodyClass}`}
              title={blurb}
              data-testid="subscription-card-description"
            >
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
