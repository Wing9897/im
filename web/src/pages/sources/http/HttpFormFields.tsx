import type { Dispatch, SetStateAction } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Button,
  MenuSelect,
  PasswordField,
  SettingsRow,
  TextArea,
  TextField,
} from "../../../components/ui";
import {
  DEFAULT_MAX_CONTENT_CHARS,
  MAX_HTTP_HEADERS,
  MAX_MAX_CONTENT_CHARS,
  type HttpFormFields,
} from "./httpFormTypes";

interface HttpSourceFieldsProps {
  form: HttpFormFields;
  setForm: Dispatch<SetStateAction<HttpFormFields>>;
  submitting: boolean;
  isEdit?: boolean;
  idPrefix?: string;
}

export function HttpSourceFields({
  form,
  setForm,
  submitting,
  isEdit,
  idPrefix = "http",
}: HttpSourceFieldsProps) {
  const { t } = useTranslation("sources");
  const secretKeep = t("httpFields.secretKeep");

  const addHeader = () => {
    if (form.headers.length >= MAX_HTTP_HEADERS) return;
    setForm((current) => ({
      ...current,
      headers: [...current.headers, { id: `hdr_${Date.now()}`, key: "", value: "" }],
    }));
  };

  const removeHeader = (index: number) => {
    setForm((current) => {
      const next = current.headers.filter((_, i) => i !== index);
      return {
        ...current,
        headers: next.length > 0 ? next : [{ id: `hdr_${Date.now()}`, key: "", value: "" }],
      };
    });
  };

  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    setForm((current) => ({
      ...current,
      headers: current.headers.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  };

  return (
    <div className="flex flex-col gap-xl">
      <SettingsRow label={t("httpFields.url")} htmlFor={`${idPrefix}-url`}>
        <TextField
          id={`${idPrefix}-url`}
          type="url"
          placeholder="https://example.com/api/status"
          value={form.url}
          onChange={(e) => setForm((s) => ({ ...s, url: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("httpFields.displayName")} htmlFor={`${idPrefix}-name`}>
        <TextField
          id={`${idPrefix}-name`}
          type="text"
          placeholder={t("httpFields.displayNamePlaceholder")}
          value={form.name}
          onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow label={t("httpFields.method")} htmlFor={`${idPrefix}-method`}>
        <MenuSelect
          id={`${idPrefix}-method`}
          variant="field"
          value={form.method}
          options={[
            { value: "GET", label: "GET" },
            { value: "POST", label: "POST" },
          ]}
          onChange={(next) =>
            setForm((s) => ({
              ...s,
              method: next === "POST" ? "POST" : "GET",
              bodyType: next === "POST" ? s.bodyType : "none",
            }))
          }
          disabled={submitting}
          aria-label={t("httpFields.method")}
        />
      </SettingsRow>

      <SettingsRow label={t("httpFields.auth")} htmlFor={`${idPrefix}-auth`}>
        <MenuSelect
          id={`${idPrefix}-auth`}
          variant="field"
          value={form.authType}
          options={[
            { value: "none", label: t("httpFields.authNone") },
            { value: "bearer", label: t("httpFields.authBearer") },
            { value: "basic", label: t("httpFields.authBasic") },
          ]}
          onChange={(next) => {
            setForm((s) => ({
              ...s,
              authType: next === "bearer" || next === "basic" ? next : "none",
            }));
          }}
          disabled={submitting}
          aria-label={t("httpFields.auth")}
        />
      </SettingsRow>

      {form.authType === "bearer" ? (
        <SettingsRow label={t("httpFields.bearerToken")} htmlFor={`${idPrefix}-bearer`}>
          <PasswordField
            id={`${idPrefix}-bearer`}
            placeholder={isEdit ? secretKeep : t("httpFields.bearerPlaceholder")}
            value={form.bearerToken}
            onChange={(e) => setForm((s) => ({ ...s, bearerToken: e.target.value }))}
            disabled={submitting}
          />
        </SettingsRow>
      ) : null}

      {form.authType === "basic" ? (
        <>
          <SettingsRow label={t("httpFields.basicUser")} htmlFor={`${idPrefix}-basic-user`}>
            <TextField
              id={`${idPrefix}-basic-user`}
              type="text"
              value={form.basicUsername}
              onChange={(e) => setForm((s) => ({ ...s, basicUsername: e.target.value }))}
              disabled={submitting}
            />
          </SettingsRow>
          <SettingsRow label={t("httpFields.basicPassword")} htmlFor={`${idPrefix}-basic-pass`}>
            <PasswordField
              id={`${idPrefix}-basic-pass`}
              placeholder={isEdit ? secretKeep : t("httpFields.passwordPlaceholder")}
              value={form.basicPassword}
              onChange={(e) => setForm((s) => ({ ...s, basicPassword: e.target.value }))}
              disabled={submitting}
            />
          </SettingsRow>
        </>
      ) : null}

      <SettingsRow label={t("httpFields.headers", { max: MAX_HTTP_HEADERS })}>
        {form.headers.map((entry, i) => (
          <div key={entry.id} className="mb-sm flex items-center gap-sm">
            <TextField
              className="flex-1"
              placeholder={t("httpFields.headerKey")}
              value={entry.key}
              onChange={(e) => updateHeader(i, "key", e.target.value)}
              disabled={submitting}
            />
            <TextField
              className="flex-1"
              placeholder={t("httpFields.headerValue")}
              value={entry.value}
              onChange={(e) => updateHeader(i, "value", e.target.value)}
              disabled={submitting}
            />
            {(form.headers.length > 1 || entry.key || entry.value) && (
              <button
                type="button"
                className="flex min-h-6 min-w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-1 text-error transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)]"
                onClick={() => removeHeader(i)}
                disabled={submitting}
                aria-label={t("httpFields.removeHeaderAria", { index: i + 1 })}
              >
                <X size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
        {form.headers.length < MAX_HTTP_HEADERS ? (
          <Button variant="secondary" size="sm" onClick={addHeader} disabled={submitting}>
            {t("httpFields.addHeader")}
          </Button>
        ) : null}
      </SettingsRow>

      {form.method === "POST" ? (
        <>
          <SettingsRow label={t("httpFields.bodyType")} htmlFor={`${idPrefix}-body-type`}>
            <MenuSelect
              id={`${idPrefix}-body-type`}
              variant="field"
              value={form.bodyType}
              options={[
                { value: "none", label: t("httpFields.bodyNone") },
                { value: "json", label: t("httpFields.bodyJson") },
                { value: "text", label: t("httpFields.bodyText") },
                { value: "form", label: t("httpFields.bodyForm") },
              ]}
              onChange={(next) => {
                setForm((s) => ({
                  ...s,
                  bodyType:
                    next === "json" || next === "text" || next === "form" ? next : "none",
                }));
              }}
              disabled={submitting}
              aria-label={t("httpFields.bodyType")}
            />
          </SettingsRow>
          {form.bodyType !== "none" ? (
            <SettingsRow label={t("httpFields.body")} htmlFor={`${idPrefix}-body`}>
              <TextArea
                id={`${idPrefix}-body`}
                rows={4}
                placeholder={
                  form.bodyType === "json"
                    ? '{"key":"value"}'
                    : form.bodyType === "form"
                      ? t("httpFields.bodyPlaceholderForm")
                      : t("httpFields.bodyPlaceholderText")
                }
                value={form.body}
                onChange={(e) => setForm((s) => ({ ...s, body: e.target.value }))}
                disabled={submitting}
              />
            </SettingsRow>
          ) : null}
        </>
      ) : null}

      <SettingsRow
        label={t("httpFields.interval")}
        htmlFor={`${idPrefix}-poll`}
        help={t("httpFields.intervalHelp")}
      >
        <TextField
          id={`${idPrefix}-poll`}
          type="number"
          min={1}
          max={1440}
          className="max-w-[200px]"
          value={form.pollIntervalMinutes}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              pollIntervalMinutes: Math.max(1, Number(e.target.value) || 5),
            }))
          }
          disabled={submitting}
        />
      </SettingsRow>

      <SettingsRow
        label={t("httpFields.maxChars")}
        htmlFor={`${idPrefix}-max-chars`}
        help={t("httpFields.maxCharsHelp", {
          default: DEFAULT_MAX_CONTENT_CHARS,
          max: MAX_MAX_CONTENT_CHARS,
        })}
      >
        <TextField
          id={`${idPrefix}-max-chars`}
          type="number"
          min={1}
          max={MAX_MAX_CONTENT_CHARS}
          className="max-w-[200px]"
          value={form.maxContentChars}
          onChange={(e) =>
            setForm((s) => ({
              ...s,
              maxContentChars: Math.max(1, Number(e.target.value) || DEFAULT_MAX_CONTENT_CHARS),
            }))
          }
          disabled={submitting}
        />
      </SettingsRow>
    </div>
  );
}
