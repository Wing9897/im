import { useTranslation } from "react-i18next";
import {
  Button,
  FormGrid,
  SettingsRow,
  TextArea,
  TextField,
  captionClass,
} from "../../components/ui";
import type { AttributePartitions } from "../../domain/items/itemAttributes";

type DatesProps = {
  purchasedAt: string;
  expiresAt: string;
  remindBeforeDays: number | null;
  saving: boolean;
  onPurchasedAtChange: (value: string) => void;
  onExpiresAtChange: (value: string) => void;
  onRemindBeforeDaysChange: (value: number | null) => void;
};

export function ItemFormDatesSection({
  purchasedAt,
  expiresAt,
  remindBeforeDays,
  saving,
  onPurchasedAtChange,
  onExpiresAtChange,
  onRemindBeforeDaysChange,
}: DatesProps) {
  const { t } = useTranslation("items");
  return (
    <section
      className="flex flex-col gap-md rounded-lg border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-raised)_40%,transparent)] p-md"
      aria-label={t("sectionDates")}
    >
      <h3 className="m-0 text-caption font-semibold text-text-primary">
        {t("sectionDates")}
      </h3>
      <FormGrid>
        <SettingsRow label={t("purchasedAt")} htmlFor="item-purchased">
          <TextField
            id="item-purchased"
            type="date"
            value={purchasedAt}
            onChange={(e) => onPurchasedAtChange(e.target.value)}
            disabled={saving}
          />
        </SettingsRow>
        <SettingsRow label={t("expiresAt")} htmlFor="item-expires">
          <TextField
            id="item-expires"
            type="date"
            value={expiresAt}
            onChange={(e) => onExpiresAtChange(e.target.value)}
            disabled={saving}
          />
        </SettingsRow>
      </FormGrid>
      <SettingsRow label={t("remindBeforeDays")} htmlFor="item-remind">
        <TextField
          id="item-remind"
          type="number"
          min={0}
          value={remindBeforeDays ?? ""}
          onChange={(e) =>
            onRemindBeforeDaysChange(e.target.value === "" ? null : Number(e.target.value))
          }
          disabled={saving}
        />
      </SettingsRow>
    </section>
  );
}

type AttributesProps = {
  partitions: AttributePartitions;
  extraKey: string;
  extraValue: string;
  saving: boolean;
  onAttrChange: (key: string, value: string) => void;
  onExtraKeyChange: (value: string) => void;
  onExtraValueChange: (value: string) => void;
  onAddExtra: () => void;
};

export function ItemFormAttributesSection({
  partitions,
  extraKey,
  extraValue,
  saving,
  onAttrChange,
  onExtraKeyChange,
  onExtraValueChange,
  onAddExtra,
}: AttributesProps) {
  const { t } = useTranslation("items");
  const hasPartitions =
    partitions.suggested.length > 0 || partitions.other.length > 0;

  return (
    <>
      {hasPartitions ? (
        <section
          className="flex flex-col gap-md rounded-lg border border-dashed border-surface-border/80 p-md"
          aria-label={t("sectionExtras")}
        >
          <div>
            <h3 className="m-0 text-caption font-semibold text-text-primary">
              {t("sectionExtras")}
            </h3>
            <p className={`${captionClass} mt-xs`}>{t("sectionExtrasHint")}</p>
          </div>

          {partitions.suggested.length > 0 ? (
            <div className="flex flex-col gap-md">
              <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {t("attributesSuggested")}
              </p>
              {partitions.suggested.map((field) => (
                <SettingsRow
                  key={field.key}
                  label={field.label}
                  htmlFor={`item-attr-${field.key}`}
                >
                  <TextField
                    id={`item-attr-${field.key}`}
                    value={field.value}
                    onChange={(e) => onAttrChange(field.key, e.target.value)}
                    disabled={saving}
                  />
                </SettingsRow>
              ))}
            </div>
          ) : null}

          {partitions.other.length > 0 ? (
            <div className="flex flex-col gap-md">
              <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {t("attributesOther")}
              </p>
              {partitions.other.map((field) => (
                <SettingsRow
                  key={field.key}
                  label={field.key}
                  htmlFor={`item-other-${field.key}`}
                >
                  <TextField
                    id={`item-other-${field.key}`}
                    value={field.value}
                    onChange={(e) => onAttrChange(field.key, e.target.value)}
                    disabled={saving}
                  />
                </SettingsRow>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-end gap-sm">
        <div className="min-w-[120px] flex-1">
          <SettingsRow label={t("attributeKey")} htmlFor="item-extra-key">
            <TextField
              id="item-extra-key"
              placeholder={t("attributeKey")}
              value={extraKey}
              onChange={(e) => onExtraKeyChange(e.target.value)}
              disabled={saving}
            />
          </SettingsRow>
        </div>
        <div className="min-w-[120px] flex-1">
          <SettingsRow label={t("attributeValue")} htmlFor="item-extra-value">
            <TextField
              id="item-extra-value"
              placeholder={t("attributeValue")}
              value={extraValue}
              onChange={(e) => onExtraValueChange(e.target.value)}
              disabled={saving}
            />
          </SettingsRow>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mb-0.5"
          disabled={saving}
          onClick={onAddExtra}
        >
          {t("addAttribute")}
        </Button>
      </div>
    </>
  );
}

type NotesProps = {
  notes: string;
  saving: boolean;
  onNotesChange: (value: string) => void;
};

export function ItemFormNotesSection({ notes, saving, onNotesChange }: NotesProps) {
  const { t } = useTranslation("items");
  return (
    <SettingsRow label={t("notes")} htmlFor="item-notes">
      <TextArea
        id="item-notes"
        rows={3}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={saving}
        className="min-h-[88px]"
      />
    </SettingsRow>
  );
}
