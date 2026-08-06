import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { ItemsPageChrome } from "./ItemsPageChrome";
import { itemsPageChromePrimaryActionClass } from "./itemsPageChromeClasses";

interface ItemFormToolbarProps {
  isEditMode: boolean;
  canSave: boolean;
  busy: boolean;
  onBack: () => void;
  onSave: () => void;
}

/**
 * Form-layer top strip — shared ItemsPageChrome (ChatEditor sticky language).
 * Form body keeps `formPageMaxWidthClass`; chrome stays max-w-5xl.
 */
export function ItemFormToolbar({
  isEditMode,
  canSave,
  busy,
  onBack,
  onSave,
}: ItemFormToolbarProps) {
  const { t } = useTranslation("items");

  return (
    <ItemsPageChrome
      title={isEditMode ? t("editItem") : t("addItem")}
      back={{
        onClick: onBack,
        ariaLabel: t("backToList"),
        disabled: busy,
      }}
      actions={
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
      }
      data-testid="item-form-toolbar"
    />
  );
}
