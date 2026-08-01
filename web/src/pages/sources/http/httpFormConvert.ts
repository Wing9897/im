import type { HttpSourceInfo } from "../../../types";
import i18n from "../../../i18n";
import {
  DEFAULT_MAX_CONTENT_CHARS,
  MAX_MAX_CONTENT_CHARS,
  type HeaderEntry,
  type HttpFormFields,
} from "./httpFormTypes";

function headersToEntries(headers: Record<string, string> | undefined): HeaderEntry[] {
  const entries = Object.entries(headers || {}).map(([key, value], index) => ({
    id: `hdr_${index}_${key}`,
    key,
    value,
  }));
  return entries.length > 0 ? entries : [{ id: `hdr_${Date.now()}`, key: "", value: "" }];
}

function entriesToHeaders(entries: HeaderEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of entries) {
    const key = entry.key.trim();
    if (!key) continue;
    out[key] = entry.value;
  }
  return out;
}

export function sourceToForm(source: HttpSourceInfo): HttpFormFields {
  return {
    url: source.url,
    name: source.account.name || "",
    method: source.method === "POST" ? "POST" : "GET",
    authType:
      source.authType === "bearer" || source.authType === "basic" ? source.authType : "none",
    bearerToken: source.bearerToken || "",
    basicUsername: source.basicUsername || "",
    basicPassword: source.basicPassword || "",
    headers: headersToEntries(source.headers),
    bodyType:
      source.bodyType === "json" || source.bodyType === "text" || source.bodyType === "form"
        ? source.bodyType
        : "none",
    body: source.body || "",
    pollIntervalMinutes: Math.max(1, Math.round(source.pollIntervalSeconds / 60)),
    maxContentChars: source.maxContentChars || DEFAULT_MAX_CONTENT_CHARS,
  };
}

export function formToCreatePayload(form: HttpFormFields) {
  return {
    url: form.url.trim(),
    name: form.name.trim() || null,
    method: form.method,
    authType: form.authType,
    bearerToken: form.authType === "bearer" ? form.bearerToken.trim() || null : null,
    basicUsername: form.authType === "basic" ? form.basicUsername.trim() || null : null,
    basicPassword: form.authType === "basic" ? form.basicPassword || null : null,
    headers: entriesToHeaders(form.headers),
    bodyType: form.method === "POST" ? form.bodyType : "none",
    body: form.method === "POST" && form.bodyType !== "none" ? form.body : null,
    pollIntervalSeconds: Math.max(60, form.pollIntervalMinutes * 60),
    maxContentChars: Math.min(
      MAX_MAX_CONTENT_CHARS,
      Math.max(1, form.maxContentChars || DEFAULT_MAX_CONTENT_CHARS),
    ),
  };
}

/** Patch uses the same shape as create (full replace of editable fields). */
export const formToPatch = formToCreatePayload;

export function validateHttpSourceForm(form: HttpFormFields): string | null {
  const url = form.url.trim();
  if (!url) return String(i18n.t("sources:httpValidate.urlRequired"));
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return String(i18n.t("sources:httpValidate.urlHttp"));
  }
  if (form.authType === "bearer" && !form.bearerToken.trim()) {
    return String(i18n.t("sources:httpValidate.bearerRequired"));
  }
  if (form.authType === "basic" && !form.basicUsername.trim()) {
    return String(i18n.t("sources:httpValidate.basicUserRequired"));
  }
  if (form.maxContentChars < 1 || form.maxContentChars > MAX_MAX_CONTENT_CHARS) {
    return String(
      i18n.t("sources:httpValidate.maxCharsRange", { max: MAX_MAX_CONTENT_CHARS }),
    );
  }
  return null;
}
