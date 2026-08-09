/**
 * Résumé-style identity block for the item create/edit form.
 * Left: large circular avatar (emoji now; image/`object-cover` later).
 * Right: title (+ archive badge), quantity/unit/price. Category / workset live in {@link ItemFormCvBelonging}.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PenLine } from "lucide-react";
import { Badge, TextField } from "../../../components/ui";
import { cardTitleClass, captionClass } from "../../../components/ui/pageTypography";
import type { TrackableItem } from "../../../api/items";
import { EmojiPickerField } from "../emoji/EmojiPickerField";
import { ItemFormCvInventory } from "./ItemFormCvInventory";
import { itemFormIconButtonClass } from "./itemFormClasses";

const cvTitleClass = `m-0 min-w-0 break-words ${cardTitleClass}`;
const cvTitlePlaceholderClass = `m-0 min-w-0 break-words ${captionClass}`;

type HeaderProps = {
  title: string;
  emoji: string;
  categoryEmojiPlaceholder?: string | null;
  /** Edit-mode item — drives archive badge preview. */
  item: TrackableItem | null;
  busy: boolean;
  quantityInput: string;
  unit: string;
  priceInput: string;
  onTitleChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onQuantityInputChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  onPriceInputChange: (value: string) => void;
};

export function ItemFormCvHeader({
  title,
  emoji,
  categoryEmojiPlaceholder,
  item,
  busy,
  quantityInput,
  unit,
  priceInput,
  onTitleChange,
  onEmojiChange,
  onQuantityInputChange,
  onUnitChange,
  onPriceInputChange,
}: HeaderProps) {
  const { t } = useTranslation("items");
  const archived = item?.status === "archived";
  /** Read-only title + pen; input only after explicit edit. */
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);

  useEffect(() => {
    if (!editingTitle) setTitleDraft(title);
  }, [title, editingTitle]);

  const commitTitle = () => {
    const next = titleDraft.trim();
    onTitleChange(next);
    setTitleDraft(next);
    setEditingTitle(false);
  };

  const hasTitle = Boolean(title.trim());
  const displayTitle = hasTitle ? title.trim() : t("titleField");

  return (
    <header
      className="flex items-start gap-md"
      data-testid="item-form-cv-header"
      aria-label={t("cvHeaderAria")}
    >
      <EmojiPickerField
        id="item-emoji"
        value={emoji}
        onChange={onEmojiChange}
        disabled={busy}
        placeholder={categoryEmojiPlaceholder ?? undefined}
        variant="avatar"
      />

      <div className="flex min-w-0 flex-1 items-start gap-xs pt-0.5">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {editingTitle ? (
            <TextField
              id="item-title"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              disabled={busy}
              autoFocus
              placeholder={t("titleField")}
              aria-label={t("titleField")}
              className="w-full"
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitTitle();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setTitleDraft(title);
                  setEditingTitle(false);
                }
              }}
            />
          ) : (
            <div className="flex min-w-0 items-center gap-1">
              <p
                className={hasTitle ? cvTitleClass : cvTitlePlaceholderClass}
                data-testid="item-form-cv-title-display"
                title={displayTitle}
              >
                <span className="block break-words">{displayTitle}</span>
              </p>
              <button
                type="button"
                className={`shrink-0 ${itemFormIconButtonClass}`}
                disabled={busy}
                aria-label={t("editTitleAria")}
                data-testid="item-form-cv-title-edit"
                onClick={() => {
                  setTitleDraft(title);
                  setEditingTitle(true);
                }}
              >
                <PenLine size={14} strokeWidth={2} aria-hidden />
              </button>
            </div>
          )}

          <ItemFormCvInventory
            quantityInput={quantityInput}
            unit={unit}
            priceInput={priceInput}
            busy={busy}
            onQuantityInputChange={onQuantityInputChange}
            onUnitChange={onUnitChange}
            onPriceInputChange={onPriceInputChange}
          />
        </div>
        {archived ? (
          <Badge
            tone="neutral"
            className="shrink-0 normal-case tracking-normal"
            data-testid="item-form-cv-status-badge"
          >
            {t("statusArchived")}
          </Badge>
        ) : null}
      </div>
    </header>
  );
}
