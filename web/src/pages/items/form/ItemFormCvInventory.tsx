/**
 * Optional inventory metadata in the CV header: quantity + unit paired.
 * Fixed item-level fields — not category attribute schema.
 * Money lives on purchase/effective linked calendars (amount/direction).
 */

import { useTranslation } from "react-i18next";
import { FieldLabel, TextField } from "../../../components/ui";
import { parseOptionalNumberInput } from "../../../domain/items/itemInventoryDisplay";
import { itemFormInventoryRowClass } from "./itemFormClasses";
import { ItemUnitCombobox } from "./ItemUnitCombobox";

type Props = {
  quantityInput: string;
  unit: string;
  busy: boolean;
  onQuantityInputChange: (value: string) => void;
  onUnitChange: (value: string) => void;
};

export function ItemFormCvInventory({
  quantityInput,
  unit,
  busy,
  onQuantityInputChange,
  onUnitChange,
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
    </div>
  );
}

export function quantityInputFromValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return String(value);
}

export function wireQuantityFromInput(raw: string): number | null {
  return parseOptionalNumberInput(raw);
}
