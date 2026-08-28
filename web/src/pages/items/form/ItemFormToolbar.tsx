import { Archive, ArchiveRestore, Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/ui";
import { ItemsPageChrome } from "../ItemsPageChrome";
import { itemsPageChromePrimaryActionClass } from "../../../styles/itemsPageChromeClasses";

interface ItemFormToolbarProps {
  isEditMode: boolean;
  canSave: boolean;
  busy: boolean;
  /** Present in edit mode so the archive toggle can show the right label. */
  itemStatus?: "active" | "archived" | null;
  onBack: () => void;
  onSave: () => void;
  /** Edit-mode only: toggle archived ↔ active. */
  onArchiveToggle?: () => void;
  /** Edit-mode only: duplicate scalar fields (no linked calendars). */
  onDuplicate?: () => void;
}

/**
 * Form-layer top strip — shared ItemsPageChrome (ChatEditor sticky language).
 * Form body + chrome share `itemsFormPageMaxWidthClass` (1280); other desk forms stay 768.
 */
export function ItemFormToolbar({
  isEditMode,
  canSave,
  busy,
  itemStatus = null,
  onBack,
  onSave,
  onArchiveToggle,
  onDuplicate,
}: ItemFormToolbarProps) {
  const { t } = useTranslation("items");
  const archived = itemStatus === "archived";
  const archiveLabel = archived ? t("unarchive") : t("archive");

  return (
    <ItemsPageChrome
      title={isEditMode ? t("editItem") : t("addItem")}
      back={{
        onClick: onBack,
        ariaLabel: t("backToList"),
        disabled: busy,
      }}
      actions={
        <>
          {isEditMode && onArchiveToggle ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              data-testid="item-form-archive"
              onClick={onArchiveToggle}
              aria-label={archiveLabel}
              title={archiveLabel}
            >
              {archived ? (
                <ArchiveRestore size={14} strokeWidth={2} aria-hidden="true" />
              ) : (
                <Archive size={14} strokeWidth={2} aria-hidden="true" />
              )}
              <span>{archiveLabel}</span>
            </Button>
          ) : null}
          {isEditMode && onDuplicate ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              data-testid="item-form-duplicate"
              onClick={onDuplicate}
              aria-label={t("duplicateItem")}
              title={t("duplicateItem")}
            >
              <Copy size={14} strokeWidth={2} aria-hidden="true" />
              <span>{t("duplicateItem")}</span>
            </Button>
          ) : null}
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave || busy}
            data-testid="item-form-save"
            className={itemsPageChromePrimaryActionClass}
            onClick={onSave}
          >
            {busy ? (
              <span className="im-refresh-indicator mx-auto" aria-hidden="true" />
            ) : (
              t("save")
            )}
          </Button>
        </>
      }
      data-testid="item-form-toolbar"
    />
  );
}
