import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PenLine, Trash2 } from "lucide-react";

import { TextArea, TextField } from "../../../components/ui";
import { cardBodyClass, formLabelClass } from "../../../components/ui/pageTypography";
import type { AttributePartitions } from "../../../domain/items/itemAttributes";
import { ItemFormCvSection } from "./ItemFormCvSection";
import {
  itemFormAttributeChipClass,
  itemFormAttributeGridClass,
  itemFormIconButtonClass,
  itemFormIconButtonDangerClass,
} from "./itemFormClasses";

type AttributesProps = {
  partitions: AttributePartitions;
  saving: boolean;
  onAttrChange: (key: string, value: string) => void;
  onAttrRemove: (key: string) => void;
};

type AttributeField = {
  key: string;
  label: string;
  value: string;
  suggested: boolean;
};

function AttributeFieldCell({
  field,
  saving,
  editing,
  onStartEdit,
  onCommit,
  onRemove,
}: {
  field: AttributeField;
  saving: boolean;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (value: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("items");
  const [draft, setDraft] = useState(field.value);
  const displayValue = field.value.trim() || t("attributeEmptyValue");
  const inputId = field.suggested
    ? `item-attr-${field.key}`
    : `item-other-${field.key}`;

  useEffect(() => {
    if (editing) setDraft(field.value);
  }, [editing, field.value]);

  return (
    <div
      className={itemFormAttributeChipClass}
      data-testid={`item-form-attribute-chip-${field.key}`}
    >
      <div className="absolute right-1 top-1 flex items-center gap-0.5">
        <button
          type="button"
          className={itemFormIconButtonClass}
          disabled={saving}
          aria-label={t("editAttributeAria", { name: field.label })}
          data-testid={`item-form-attribute-edit-${field.key}`}
          onClick={onStartEdit}
        >
          <PenLine size={12} strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          className={itemFormIconButtonDangerClass}
          disabled={saving}
          aria-label={t("deleteAttributeAria", { name: field.label })}
          data-testid={`item-form-attribute-delete-${field.key}`}
          onClick={onRemove}
        >
          <Trash2 size={12} strokeWidth={2} aria-hidden />
        </button>
      </div>

      <span
        className={`block w-full min-w-0 truncate pr-10 text-left ${formLabelClass}`}
        title={field.label}
      >
        {field.label}
      </span>

      {editing ? (
        <TextField
          id={inputId}
          className="mt-0.5 w-full min-w-0"
          value={draft}
          disabled={saving}
          autoFocus
          placeholder={t("attributeValuePlaceholder")}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            onCommit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onCommit(draft);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className={`mt-0.5 w-full min-w-0 border-0 bg-transparent p-0 text-left ${cardBodyClass} font-medium text-text-primary`}
          disabled={saving}
          title={displayValue}
          onClick={onStartEdit}
        >
          <span className="block break-words whitespace-normal">{displayValue}</span>
        </button>
      )}
    </div>
  );
}

export function ItemFormAttributesSection({
  partitions,
  saving,
  onAttrChange,
  onAttrRemove,
}: AttributesProps) {
  const { t } = useTranslation("items");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const fields: AttributeField[] = [
    ...partitions.suggested.map((field) => ({
      key: field.key,
      label: field.label,
      value: field.value,
      suggested: true,
    })),
    ...partitions.other.map((field) => ({
      key: field.key,
      label: field.key,
      value: field.value,
      suggested: false,
    })),
  ];

  if (fields.length === 0) return null;

  return (
    <ItemFormCvSection
      title={t("sectionExtras")}
      testId="item-form-extras"
      ariaLabel={t("sectionExtras")}
    >
      <div
        className={itemFormAttributeGridClass}
        data-testid="item-form-attribute-grid"
        aria-label={t("attributeGridAria")}
      >
        {fields.map((field) => (
          <AttributeFieldCell
            key={field.key}
            field={field}
            saving={saving}
            editing={editingKey === field.key}
            onStartEdit={() => setEditingKey(field.key)}
            onCommit={(value) => {
              onAttrChange(field.key, value);
              setEditingKey(null);
            }}
            onRemove={() => {
              onAttrRemove(field.key);
              if (editingKey === field.key) setEditingKey(null);
            }}
          />
        ))}
      </div>
    </ItemFormCvSection>
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
    <ItemFormCvSection
      title={t("sectionNotes")}
      testId="item-form-notes"
      ariaLabel={t("sectionNotes")}
    >
      <TextArea
        id="item-notes"
        rows={5}
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={saving}
        aria-label={t("sectionNotes")}
        className="min-h-[7rem] w-full resize-y"
      />
    </ItemFormCvSection>
  );
}
