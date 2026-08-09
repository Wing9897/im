import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { ItemCategory } from "../../../api/items";
import { ensureOptionInList } from "../../../domain/items/ensureSelectOption";
import type { Workset } from "../../../types/worksets";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { MenuSelect, SettingsRow } from "../../../components/ui";
import {
  itemFormBelongingGridClass,
  itemFormBelongingSelectWrapClass,
} from "./itemFormClasses";

type Props = {
  worksetId: string;
  categoryId: string | null;
  categories: ItemCategory[];
  worksets: Workset[];
  categoryLabel: (
    category: ItemCategory | null | undefined,
    t: (key: string) => string,
  ) => string;
  busy: boolean;
  onWorksetChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
};

function formatCategoryOptionLabel(
  category: ItemCategory,
  categoryLabel: Props["categoryLabel"],
  t: (key: string) => string,
): string {
  const emoji = category.emoji?.trim();
  return `${emoji ? `${emoji} ` : ""}${categoryLabel(category, t)}`;
}

/**
 * Category + workset — separated from the name line so identity stays clean.
 */
export function ItemFormCvBelonging({
  worksetId,
  categoryId,
  categories,
  worksets,
  categoryLabel,
  busy,
  onWorksetChange,
  onCategoryChange,
}: Props) {
  const { t } = useTranslation("items");
  const resolvedWorksetId = worksetId.trim() || SYSTEM_WORKSET_ID;

  const categoryRows = useMemo(
    () =>
      ensureOptionInList(categories, categoryId, (id) => ({
        id,
        name: id,
        slug: null,
        sortOrder: 999,
        color: null,
        emoji: null,
        fieldSchema: [],
        defaultRemindBeforeDays: null,
        createdAt: null,
        updatedAt: null,
      })),
    [categories, categoryId],
  );

  const worksetRows = useMemo(
    () =>
      ensureOptionInList(worksets, resolvedWorksetId, (id) => ({
        id,
        name: id,
        isSystem: false,
        createdAt: "",
        updatedAt: "",
      })),
    [worksets, resolvedWorksetId],
  );

  const categorySelectOptions = useMemo(
    () => [
      { value: "", label: t("noCategory") },
      ...categoryRows.map((category) => ({
        value: category.id,
        label: formatCategoryOptionLabel(category, categoryLabel, t),
      })),
    ],
    [categoryRows, categoryLabel, t],
  );

  const worksetSelectOptions = useMemo(
    () => worksetRows.map((workset) => ({ value: workset.id, label: workset.name })),
    [worksetRows],
  );

  return (
    <div
      className={itemFormBelongingGridClass}
      data-testid="item-form-cv-meta"
      aria-label={t("cvBelongingAria")}
    >
      <SettingsRow dense label={t("category")} htmlFor="item-category">
        <MenuSelect
          id="item-category"
          variant="field"
          value={categoryId ?? ""}
          options={categorySelectOptions}
          onChange={onCategoryChange}
          disabled={busy}
          aria-label={t("category")}
          className={itemFormBelongingSelectWrapClass}
          data-testid="item-form-category-select"
        />
      </SettingsRow>

      <SettingsRow dense label={t("workset")} htmlFor="item-workset">
        <MenuSelect
          id="item-workset"
          variant="field"
          value={resolvedWorksetId}
          options={worksetSelectOptions}
          onChange={onWorksetChange}
          disabled={busy}
          aria-label={t("workset")}
          className={itemFormBelongingSelectWrapClass}
          data-testid="item-form-workset-select"
        />
      </SettingsRow>
    </div>
  );
}
