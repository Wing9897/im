/**
 * Item entry tile for the /items category list layer (and workset detail reuse).
 * Résumé / ID-card layout: large avatar, multi-line title, notes + inventory.
 */

import { AlignLeft, Archive, ArchiveRestore, Clock, Copy, Package, Pencil, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AccentBarCard, Badge, CardFieldRow } from "../ui";
import { cardBodyClass, cardMetaClass, cardTitleClass } from "../ui/pageTypography";
import type { TrackableItem } from "../../api/items";
import {
  expiryToneAccentClass,
  expiryToneBadgeTone,
} from "../../domain/items/itemExpiryTone";
import {
  itemCardExpirySubtitle,
  itemExpiryBadgeLabel,
  resolveItemCardExpiry,
} from "../../domain/items/itemCardExpiry";
import { itemInventorySummary } from "../../domain/items/itemInventoryDisplay";
import { ItemCardEmojiPicker } from "./emoji/ItemCardEmojiPicker";

const actionIconBtnClass =
  "im-icon-btn !h-7 !w-7 !rounded-md text-text-secondary transition-colors";
const dangerIconBtnClass =
  "im-icon-btn !h-7 !w-7 !rounded-md text-error transition-colors hover:bg-[color-mix(in_srgb,var(--error)_10%,transparent)] hover:text-error";

const entryCardTitleClass = `m-0 line-clamp-2 min-w-0 break-words ${cardTitleClass}`;
const entryCardNotesClass = `m-0 line-clamp-2 ${cardBodyClass}`;

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
  /** Toggle archived ↔ active (clicks stop propagation). */
  onArchive?: () => void;
  /** Create a copy without linked calendars (clicks stop propagation). */
  onDuplicate?: () => void;
  /** When set, renders desk-density edit/delete icon buttons. */
  onDelete?: () => void;
  testId?: string;
};

export function ItemsEntryCard({
  item,
  emoji,
  categoryLabel,
  emojiBackgroundColor,
  onOpen,
  onEmojiChange,
  onArchive,
  onDuplicate,
  onDelete,
  testId,
}: Props) {
  const { t } = useTranslation("items");
  const expiry = resolveItemCardExpiry(item);
  const { tone } = expiry;
  const subtitle = itemCardExpirySubtitle(expiry, t);
  const expiryBadge = itemExpiryBadgeLabel(expiry, t);
  const showActions = Boolean(onArchive || onDuplicate || onDelete);
  const archived = item.status === "archived";
  const archiveLabel = archived ? t("unarchive") : t("archive");
  const notesPreview = item.notes?.trim() || null;
  const inventoryLine = useMemo(() => itemInventorySummary(item), [item]);
  const hasDetails = Boolean(notesPreview || inventoryLine);

  return (
    <AccentBarCard
      accentClass={expiryToneAccentClass(tone)}
      material="elevated"
      interactive
      enter="rise"
      density="default"
      className="min-h-[10.5rem]"
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
      <div className="flex h-full min-h-0 flex-col gap-sm">
        <div className="flex items-start gap-md">
          <ItemCardEmojiPicker
            emoji={emoji}
            name={item.title}
            backgroundColor={emojiBackgroundColor}
            avatarSize="card"
            onSelect={onEmojiChange}
            testId={`items-entry-emoji-${item.id}`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start gap-xs">
                  <h3 className={entryCardTitleClass} title={item.title}>
                    {item.title}
                  </h3>
                  {archived ? (
                    <Badge tone="neutral" className="normal-case tracking-normal shrink-0">
                      {t("statusArchived")}
                    </Badge>
                  ) : null}
                </div>
                <CardFieldRow
                  icon={Clock}
                  text={subtitle}
                  empty={tone === "none"}
                  className={`mt-1 ${cardBodyClass}`}
                />
              </div>

              {showActions ? (
                <div
                  className="flex shrink-0 flex-nowrap items-center gap-0.5"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {onArchive ? (
                    <button
                      type="button"
                      className={actionIconBtnClass}
                      onClick={onArchive}
                      aria-label={archiveLabel}
                      title={archiveLabel}
                      data-testid={`items-entry-archive-${item.id}`}
                    >
                      {archived ? (
                        <ArchiveRestore size={14} strokeWidth={2} aria-hidden="true" />
                      ) : (
                        <Archive size={14} strokeWidth={2} aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                  {onDuplicate ? (
                    <button
                      type="button"
                      className={actionIconBtnClass}
                      onClick={onDuplicate}
                      aria-label={t("duplicateItemAria", { name: item.title })}
                      title={t("duplicateItem")}
                      data-testid={`items-entry-duplicate-${item.id}`}
                    >
                      <Copy size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={actionIconBtnClass}
                    onClick={onOpen}
                    aria-label={t("editItemAria", { name: item.title })}
                    title={t("editItem")}
                    data-testid={`items-entry-edit-${item.id}`}
                  >
                    <Pencil size={14} strokeWidth={2} aria-hidden="true" />
                  </button>
                  {onDelete ? (
                    <button
                      type="button"
                      className={dangerIconBtnClass}
                      onClick={onDelete}
                      aria-label={t("deleteItemAria", { name: item.title })}
                      title={t("deleteItem")}
                      data-testid={`items-entry-delete-${item.id}`}
                    >
                      <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {hasDetails ? (
          <div
            className="flex min-w-0 flex-col gap-0.5 border-t border-surface-border/45 pt-sm"
            data-testid={`items-entry-card-details-${item.id}`}
          >
            {notesPreview ? (
              <CardFieldRow
                icon={AlignLeft}
                text={notesPreview}
                clamp
                className={entryCardNotesClass}
              />
            ) : null}
            {inventoryLine ? (
              <CardFieldRow
                icon={Package}
                text={inventoryLine}
                testId={`items-entry-inventory-${item.id}`}
                className={cardMetaClass}
              />
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-xs pt-xs">
          {categoryLabel ? (
            <Badge tone="neutral" className="normal-case tracking-normal">
              {categoryLabel}
            </Badge>
          ) : null}
          {expiryBadge ? (
            <Badge tone={expiryToneBadgeTone(tone)} className="normal-case tracking-normal">
              {expiryBadge}
            </Badge>
          ) : null}
        </div>
      </div>
    </AccentBarCard>
  );
}
