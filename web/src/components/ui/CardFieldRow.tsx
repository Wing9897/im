import type { LucideIcon } from "lucide-react";

/** Field-row Lucide (Clock / MapPin / AlignLeft) — smaller than the title mark. */
export const CARD_FIELD_ICON_PROPS = {
  size: 14,
  strokeWidth: 2,
} as const;

/** Title-row Lucide (workset Layers, schedule CalendarDays) — one header row with the tag. */
export const CARD_TITLE_ICON_PROPS = {
  size: 20,
  strokeWidth: 2,
} as const;

export type CardFieldIconTone = "muted" | "secondary" | "accent";

const TONE_CLASS: Record<CardFieldIconTone, string> = {
  muted: "text-text-muted",
  secondary: "text-text-secondary",
  accent: "text-accent",
};

/** Header row: leading title icon + title + optional tag. */
export const cardTitleHeaderClass = "flex items-start justify-between gap-sm";
export const cardTitleLeadClass = "flex min-w-0 flex-1 items-center gap-xs";

/** Leading Lucide mark for card/list field rows. */
export function CardFieldIcon({
  icon: Icon,
  tone = "muted",
}: {
  icon: LucideIcon;
  tone?: CardFieldIconTone;
}) {
  return (
    <Icon
      size={CARD_FIELD_ICON_PROPS.size}
      strokeWidth={CARD_FIELD_ICON_PROPS.strokeWidth}
      className={`shrink-0 ${TONE_CLASS[tone]}`}
      aria-hidden
    />
  );
}

/** Large leading Lucide mark beside the card title (bigger than field-row 14px). */
export function CardTitleIcon({
  icon: Icon,
  tone = "secondary",
  testId = "card-title-icon",
}: {
  icon: LucideIcon;
  tone?: CardFieldIconTone;
  testId?: string;
}) {
  return (
    <Icon
      size={CARD_TITLE_ICON_PROPS.size}
      strokeWidth={CARD_TITLE_ICON_PROPS.strokeWidth}
      className={`shrink-0 ${TONE_CLASS[tone]}`}
      aria-hidden
      data-testid={testId}
    />
  );
}

type CardFieldRowProps = {
  icon: LucideIcon;
  text: string;
  testId?: string;
  /** Multi-line notes; otherwise single-line truncate. */
  clamp?: boolean;
  /** Empty / N/A rows use muted mark; filled rows use secondary. */
  empty?: boolean;
  title?: string;
  className?: string;
  textClassName?: string;
};

/** Icon + caption row used by schedule / task / item / timeline cards. */
export function CardFieldRow({
  icon,
  text,
  testId,
  clamp = false,
  empty = false,
  title,
  className,
  textClassName,
}: CardFieldRowProps) {
  return (
    <div
      className={[
        "flex min-w-0 gap-xs",
        clamp ? "items-start" : "items-center",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={testId}
      title={title ?? text}
    >
      <CardFieldIcon icon={icon} tone={empty ? "muted" : "secondary"} />
      <span
        className={[
          "min-w-0",
          clamp ? "line-clamp-3 break-words" : "truncate",
          textClassName ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {text}
      </span>
    </div>
  );
}
