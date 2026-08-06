import { useTranslation } from "react-i18next";
import {
  Button,
  SettingsRow,
  TextArea,
  TextField,
  captionClass,
} from "../../components/ui";
import type { AttributePartitions } from "../../domain/items/itemAttributes";

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
          className="flex flex-col gap-xs rounded-md border border-dashed border-surface-border/70 px-sm py-xs"
          aria-label={t("sectionExtras")}
        >
          <div>
            <h3 className="m-0 text-caption font-semibold text-text-primary">
              {t("sectionExtras")}
            </h3>
            <p className={`${captionClass} mt-0.5`}>{t("sectionExtrasHint")}</p>
          </div>

          {partitions.suggested.length > 0 ? (
            <div className="flex flex-col gap-xs">
              <p className="m-0 text-card-meta font-medium uppercase tracking-wide text-text-muted">
                {t("attributesSuggested")}
              </p>
              {partitions.suggested.map((field) => (
                <SettingsRow
                  dense
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
            <div className="flex flex-col gap-xs">
              <p className="m-0 text-card-meta font-medium uppercase tracking-wide text-text-muted">
                {t("attributesOther")}
              </p>
              {partitions.other.map((field) => (
                <SettingsRow
                  dense
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

      <div className="flex flex-wrap items-end gap-xs">
        <div className="min-w-[120px] flex-1">
          <SettingsRow dense label={t("attributeKey")} htmlFor="item-extra-key">
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
          <SettingsRow dense label={t("attributeValue")} htmlFor="item-extra-value">
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
    <SettingsRow dense label={t("notes")} htmlFor="item-notes">
      <TextArea
        id="item-notes"
        rows={3}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={saving}
        className="min-h-[64px]"
      />
    </SettingsRow>
  );
}
