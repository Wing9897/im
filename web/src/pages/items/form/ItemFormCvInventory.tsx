import { useTranslation } from "react-i18next";
import { FieldLabel, TextField } from "../../../components/ui";
import { parseOptionalNumberInput } from "../../../domain/items/itemInventoryDisplay";
import { itemFormInventoryRowClass } from "./itemFormClasses";
import { ItemUnitCombobox } from "./ItemUnitCombobox";

type Props = {
  quantityInput: string;
  unit: string;
  priceInput: string;
  busy: boolean;
  onQuantityInputChange: (value: string) => void;
  onUnitChange: (value: string) => void;
  onPriceInputChange: (value: string) => void;
};

/**
 * Optional inventory metadata in the CV header: quantity + unit paired, price nearby.
 * Fixed item-level fields — not category attribute schema.
 */
export function ItemFormCvInventory({
  quantityInput,
  unit,
  priceInput,
  busy,
  onQuantityInputChange,
  onUnitChange,
  onPriceInputChange,
}: Props) {
  const { t } = useTranslation("items");

  return (
    <div
      className={itemFormInventoryRowClass}
      data-testid="item-form-cv-inventory"
      aria-label={t("cvInventoryAria")}
    >
      <div
        className="flex min-w-0 flex-wrap items-end gap-x-sm gap-y-xs"
        data-testid="item-form-cv-inventory-qty-unit"
      >
        <div className="flex w-auto min-w-0 flex-col gap-0.5">
          <FieldLabel htmlFor="item-quantity">{t("quantity")}</FieldLabel>
          <TextField
            id="item-quantity"
            type="number"
            inputMode="decimal"
            step="any"
            min={0}
            value={quantityInput}
            placeholder={t("quantityPlaceholder")}
            disabled={busy}
            onChange={(event) => onQuantityInputChange(event.target.value)}
            className="w-[4.75rem]"
            data-testid="item-form-quantity-input"
          />
        </div>
        <div className="flex min-w-[6.5rem] flex-1 flex-col gap-0.5 sm:min-w-[7.5rem] sm:max-w-[9.5rem]">
          <FieldLabel htmlFor="item-unit">{t("unit")}</FieldLabel>
          <ItemUnitCombobox
            id="item-unit"
            value={unit}
            placeholder={t("unitPlaceholder")}
            disabled={busy}
            onChange={onUnitChange}
          />
        </div>
      </div>

      <div className="flex min-w-[6.5rem] flex-col gap-0.5 sm:max-w-[8.5rem]">
        <FieldLabel htmlFor="item-price">{t("price")}</FieldLabel>
        <div className="relative w-full min-w-[6rem]">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-sm z-[1] flex items-center text-body text-text-secondary"
          >
            $
          </span>
          <TextField
            id="item-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={priceInput}
            placeholder={t("pricePlaceholder")}
            disabled={busy}
            onChange={(event) => onPriceInputChange(event.target.value)}
            className="w-full pl-6"
            data-testid="item-form-price-input"
          />
        </div>
      </div>
    </div>
  );
}

export function quantityInputFromValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

export function priceInputFromValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

export function wireQuantityFromInput(raw: string): number | null {
  return parseOptionalNumberInput(raw);
}

export function wirePriceFromInput(raw: string): number | null {
  return parseOptionalNumberInput(raw);
}
