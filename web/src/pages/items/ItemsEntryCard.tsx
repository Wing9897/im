/**
 * Item entry tile for the /items category list layer (and workset detail reuse).
 */

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AccentBarCard, Badge } from "../../components/ui";
import { cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import type { TrackableItem } from "../../api/items";
import {
  daysUntil,
  expiryTone,
  expiryToneAccentClass,
  expiryToneBadgeTone,
} from "../../domain/items/itemAttributes";
import { ItemCardEmojiPicker } from "./ItemCardEmojiPicker";

type Props = {
  item: TrackableItem;
  emoji: string;
  /** Optional category chip label. */
  categoryLabel?: string;
  /** Optional round emoji chip tint (category color). */
  emojiBackgroundColor?: string | null;
  onOpen: () => void;
  /** Persist emoji without navigating to the full edit page. */
  onEmojiChange?: (emoji: string) => void | Promise<void>;
  /** Archive / delete controls — clicks stop propagation. */
  actions?: ReactNode;
  testId?: string;
};

export function ItemsEntryCard({
  item,
  emoji,
  categoryLabel,
  emojiBackgroundColor,
  onOpen,
  onEmojiChange,
  actions,
  testId,
}: Props) {
  const { t } = useTranslation("items");
  const days = daysUntil(item.expiresAt);
  const tone = expiryTone(days, item.remindBeforeDays);

  return (
    <AccentBarCard
      accentClass={expiryToneAccentClass(tone)}
      material="elevated"
      interactive
      enter="rise"
      density="compact"
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
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-sm gap-y-xs">
        <ItemCardEmojiPicker
          emoji={emoji}
          name={item.title}
          backgroundColor={emojiBackgroundColor}
          onSelect={onEmojiChange}
          testId={`items-entry-emoji-${item.id}`}
        />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-xs">
            <h3 className={`m-0 min-w-0 truncate ${cardTitleClass}`} title={item.title}>
              {item.title}
            </h3>
            {item.status === "archived" ? (
              <Badge tone="neutral" className="normal-case tracking-normal shrink-0">
                {t("statusArchived")}
              </Badge>
            ) : null}
          </div>
          <p className={`mt-0.5 mb-0 ${cardBodyClass}`}>
            {item.expiresAt ? item.expiresAt : t("noExpiry")}
          </p>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-xs">
          {categoryLabel ? (
            <Badge tone="neutral" className="normal-case tracking-normal">
              {categoryLabel}
            </Badge>
          ) : null}
          {days != null ? (
            <Badge tone={expiryToneBadgeTone(tone)} className="normal-case tracking-normal">
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
            className="col-span-2 flex flex-wrap gap-xs"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
      </div>
    </AccentBarCard>
  );
}
