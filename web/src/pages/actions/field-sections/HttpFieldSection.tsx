import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Button,
  CheckboxField,
  FormField,
  MenuSelect,
  SettingsRow,
  TextField,
} from "../../../components/ui";
import type { ActionFormState, HeaderEntry } from "../form/useActionFormDialog";

export function HttpFields({
  form,
  fieldErrors,
  submitting,
  onChange,
}: {
  form: ActionFormState;
  fieldErrors: Record<string, string>;
  submitting: boolean;
  onChange: (field: keyof ActionFormState, value: string | boolean | number | HeaderEntry[]) => void;
}) {
  const { t } = useTranslation("actions");
  const MAX_HEADERS = 10;

  const addHeader = () => {
    if (form.httpHeaders.length >= MAX_HEADERS) return;
    onChange("httpHeaders", [...form.httpHeaders, { id: `hdr_${Date.now()}`, key: "", value: "" }]);
  };

  const removeHeader = (index: number) => {
    const next = form.httpHeaders.filter((_, i) => i !== index);
    onChange("httpHeaders", next.length > 0 ? next : [{ id: `hdr_${Date.now()}`, key: "", value: "" }]);
  };

  const updateHeader = (index: number, field: "key" | "value", val: string) => {
    const next = form.httpHeaders.map((entry, i) =>
      i === index ? { ...entry, [field]: val } : entry,
    );
    onChange("httpHeaders", next);
  };

  return (
    <div className="flex flex-col gap-lg">
      <div className="grid grid-cols-1 gap-lg sm:grid-cols-[minmax(0,1fr)_140px]">
        <SettingsRow label={t("fields.url")} htmlFor="action-http-url">
          <FormField error={fieldErrors.url}>
            <TextField
              id="action-http-url"
              type="text"
              placeholder="https://example.com/webhook"
              value={form.httpUrl}
              onChange={(e) => onChange("httpUrl", e.target.value)}
              disabled={submitting}
            />
          </FormField>
        </SettingsRow>

        <SettingsRow label={t("fields.httpMethod")} htmlFor="action-http-method">
          <MenuSelect
            id="action-http-method"
            variant="field"
            value={form.httpMethod}
            options={[
              { value: "POST", label: "POST" },
              { value: "PUT", label: "PUT" },
            ]}
            onChange={(next) => onChange("httpMethod", next)}
            disabled={submitting}
            aria-label={t("fields.httpMethod")}
          />
        </SettingsRow>
      </div>

      <SettingsRow label={t("fields.customHeaders", { max: MAX_HEADERS })}>
        {form.httpHeaders.map((entry, i) => (
          <div key={entry.id} className="mb-1.5 flex items-center gap-1.5">
            <TextField
              className="flex-1"
              type="text"
              placeholder={t("fields.headerKeyPlaceholder")}
              value={entry.key}
              onChange={(e) => updateHeader(i, "key", e.target.value)}
              disabled={submitting}
            />
            <TextField
              className="flex-1"
              type="text"
              placeholder={t("fields.headerValuePlaceholder")}
              value={entry.value}
              onChange={(e) => updateHeader(i, "value", e.target.value)}
              disabled={submitting}
            />
            {(form.httpHeaders.length > 1 || entry.key || entry.value) && (
              <button
                type="button"
                className="flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-1 text-error transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)]"
                onClick={() => removeHeader(i)}
                disabled={submitting}
                aria-label={t("fields.removeHeaderAria", { index: i + 1 })}
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {form.httpHeaders.length < MAX_HEADERS && (
          <Button variant="secondary" size="sm" onClick={addHeader} disabled={submitting}>
            {t("fields.addHeader")}
          </Button>
        )}
      </SettingsRow>

      <CheckboxField
        id="httpIncludeRawData"
        label={t("fields.includeRawData")}
        checked={form.httpIncludeRawData}
        onChange={(e) => onChange("httpIncludeRawData", e.target.checked)}
        disabled={submitting}
      />
    </div>
  );
}
