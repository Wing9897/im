/**
 * Item entry tile for the /items category list layer (and workset detail reuse).
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccentBarCard, Badge, type BadgeTone } from "../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import type { TrackableItem } from "../../api/items";
import { daysUntil, expiryTone } from "../../domain/items/itemAttributes";

type Props = {
  item: TrackableItem;
  emoji: string;
  /** Optional category chip label. */
  categoryLabel?: string;
  onOpen: () => void;
  /** Archive / delete controls — clicks stop propagation. */
  actions?: ReactNode;
  testId?: string;
};

function toneBadge(tone: ReturnType<typeof expiryTone>): BadgeTone {
  if (tone === "overdue") return "danger";
  if (tone === "soon") return "warning";
  if (tone === "ok") return "success";
  return "neutral";
}

function toneAccentClass(tone: ReturnType<typeof expiryTone>): string {
  if (tone === "overdue") return "bg-error";
  if (tone === "soon") return "bg-warning";
  if (tone === "ok") return "bg-success";
  return "bg-text-muted";
}

export function ItemsEntryCard({
  item,
  emoji,
  categoryLabel,
  onOpen,
  actions,
  testId,
}: Props) {
  const { t } = useTranslation("items");
  const days = daysUntil(item.expiresAt);
  const tone = expiryTone(days, item.remindBeforeDays);

  return (
    <AccentBarCard
      accentClass={toneAccentClass(tone)}
      material="elevated"
      interactive
      enter="rise"
      data-testid={testId ?? `items-entry-card-${item.id}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={t("openItemAria", { name: item.title })}
    >
      <div className="flex items-start justify-between gap-sm">
        <span className={`min-w-0 flex-1 truncate ${cardTitleClass}`} title={item.title}>
          <span className="mr-xs" aria-hidden>
            {emoji}
          </span>
          {item.title}
        </span>
        {item.status === "archived" ? (
          <Badge tone="neutral" className="normal-case tracking-normal shrink-0">
            {t("statusArchived")}
          </Badge>
        ) : null}
      </div>
      <p className={cardBodyClass}>
        {item.expiresAt ? item.expiresAt : t("noExpiry")}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-xs pt-xs">
        {categoryLabel ? (
          <Badge tone="neutral" className="normal-case tracking-normal">
            {categoryLabel}
          </Badge>
        ) : null}
        {days != null ? (
          <Badge tone={toneBadge(tone)} className="normal-case tracking-normal">
            {days < 0
              ? t("daysOverdue", { count: Math.abs(days) })
              : t("daysLeft", { count: days })}
          </Badge>
        ) : (
          <Badge tone="neutral" className="normal-case tracking-normal">
            {t("noExpiry")}
          </Badge>
        )}
      </div>
      {actions ? (
        <div
          className="mt-sm flex flex-wrap gap-xs"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {actions}
        </div>
      ) : null}
    </AccentBarCard>
  );
}
