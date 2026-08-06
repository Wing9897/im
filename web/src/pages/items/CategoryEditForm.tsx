import { useTranslation } from "react-i18next";
import {
  AlertBanner,
  Button,
  FormActions,
  FormStack,
  SettingsRow,
  TextField,
  captionClass,
} from "../../components/ui";
import type { ItemFieldSchemaEntry } from "../../api/items";
import { CATEGORY_COLOR_PRESETS } from "../../domain/items/categoryAggregates";
import { EmojiPickerField } from "./EmojiPickerField";

type Props = {
  name: string;
  emoji: string;
  color: string | null;
  defaultRemind: number | null;
  schema: ItemFieldSchemaEntry[];
  newKey: string;
  newLabel: string;
  error: string | null;
  busy: boolean;
  onNameChange: (value: string) => void;
  onEmojiChange: (value: string) => void;
  onColorChange: (value: string | null) => void;
  onDefaultRemindChange: (value: number | null) => void;
  onSchemaChange: (schema: ItemFieldSchemaEntry[]) => void;
  onNewKeyChange: (value: string) => void;
  onNewLabelChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

/** Inline create/edit form inside CategoryManageDialog. */
export function CategoryEditForm({
  name,
  emoji,
  color,
  defaultRemind,
  schema,
  newKey,
  newLabel,
  error,
  busy,
  onNameChange,
  onEmojiChange,
  onColorChange,
  onDefaultRemindChange,
  onSchemaChange,
  onNewKeyChange,
  onNewLabelChange,
  onCancel,
  onSave,
}: Props) {
  const { t } = useTranslation("items");

  return (
    <div className="rounded-md border border-surface-border/70 bg-[color-mix(in_srgb,var(--surface-raised)_32%,transparent)] px-sm py-xs">
      <FormStack gap="md">
        <SettingsRow dense label={t("categoryName")} htmlFor="cat-name">
          <TextField
            id="cat-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            disabled={busy}
            autoFocus
          />
        </SettingsRow>
        <SettingsRow dense label={t("emoji")} htmlFor="cat-emoji">
          <EmojiPickerField
            id="cat-emoji"
            value={emoji}
            onChange={onEmojiChange}
            disabled={busy}
          />
        </SettingsRow>
        <SettingsRow dense label={t("categoryColor")} htmlFor="cat-color">
          <div className="flex flex-col gap-xs">
            <div className="flex flex-wrap gap-xs" role="listbox" aria-label={t("categoryColor")}>
              {CATEGORY_COLOR_PRESETS.map((preset) => {
                const selected = (color ?? "").toUpperCase() === preset.toUpperCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={busy}
                    className={[
                      "h-5 w-5 rounded-full border-2",
                      selected ? "border-accent" : "border-transparent",
                    ].join(" ")}
                    style={{ backgroundColor: preset }}
                    onClick={() => onColorChange(preset)}
                    aria-label={preset}
                  />
                );
              })}
              <button
                type="button"
                disabled={busy}
                className="rounded-md border border-surface-border px-xs text-caption text-text-secondary"
                onClick={() => onColorChange(null)}
              >
                {t("categoryColorClear")}
              </button>
            </div>
            <TextField
              id="cat-color"
              placeholder={CATEGORY_COLOR_PRESETS[0]}
              value={color ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onColorChange(v || null);
              }}
              disabled={busy}
              aria-label={t("categoryColorCustom")}
            />
          </div>
        </SettingsRow>
        <SettingsRow dense label={t("defaultRemind")} htmlFor="cat-remind">
          <TextField
            id="cat-remind"
            type="number"
            min={0}
            value={defaultRemind ?? ""}
            onChange={(e) =>
              onDefaultRemindChange(e.target.value === "" ? null : Number(e.target.value))
            }
            disabled={busy}
          />
        </SettingsRow>

        <div className="flex flex-col gap-xs">
          <p className="m-0 text-caption font-medium text-text-primary">
            {t("fieldSchema")}
          </p>
          <p className={`m-0 ${captionClass}`}>{t("fieldSchemaHint")}</p>
          {schema.map((entry, idx) => (
            <div key={`${entry.key}-${idx}`} className="flex gap-xs">
              <TextField
                className="flex-1"
                value={entry.key}
                aria-label={t("attributeKey")}
                onChange={(e) => {
                  const next = [...schema];
                  next[idx] = { ...entry, key: e.target.value };
                  onSchemaChange(next);
                }}
                disabled={busy}
              />
              <TextField
                className="flex-1"
                value={entry.label}
                aria-label={t("schemaFieldLabel")}
                onChange={(e) => {
                  const next = [...schema];
                  next[idx] = { ...entry, label: e.target.value };
                  onSchemaChange(next);
                }}
                disabled={busy}
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => onSchemaChange(schema.filter((_, i) => i !== idx))}
                aria-label={t("removeSchemaField")}
              >
                ×
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-xs">
            <TextField
              className="min-w-[100px] flex-1"
              placeholder={t("attributeKey")}
              value={newKey}
              onChange={(e) => onNewKeyChange(e.target.value)}
              disabled={busy}
            />
            <TextField
              className="min-w-[100px] flex-1"
              placeholder={t("schemaFieldLabel")}
              value={newLabel}
              onChange={(e) => onNewLabelChange(e.target.value)}
              disabled={busy}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => {
                const key = newKey.trim();
                if (!key) return;
                onSchemaChange([...schema, { key, label: newLabel.trim() || key }]);
                onNewKeyChange("");
                onNewLabelChange("");
              }}
            >
              {t("addSchemaField")}
            </Button>
          </div>
        </div>

        {error ? (
          <AlertBanner variant="error" role="alert" className="mb-0">
            {error}
          </AlertBanner>
        ) : null}

        <FormActions inline>
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onSave}
            disabled={busy || !name.trim()}
          >
            {t("save")}
          </Button>
        </FormActions>
      </FormStack>
    </div>
  );
}
