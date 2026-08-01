/**
 * Map items API failures to i18n-friendly copy (avoid leaking raw English BE strings).
 */

import { ApiRequestError, NetworkError } from "../../api/client";

type ItemsT = (key: string, opts?: Record<string, unknown>) => string;

function mapValidationMessage(message: string, t: ItemsT): string | null {
  const lower = message.toLowerCase();
  if (lower.includes("title is required") || lower.includes("name is required")) {
    return t("errors.required");
  }
  if (lower.includes("attribute")) {
    return t("errors.attributes");
  }
  if (lower.includes("remind")) {
    return t("errors.remind");
  }
  if (lower.includes("date")) {
    return t("errors.date");
  }
  if (lower.includes("not found")) {
    return t("errors.notFound");
  }
  return null;
}

export function formatItemsError(err: unknown, t: ItemsT): string {
  if (err instanceof NetworkError) {
    return t("errors.network");
  }
  if (err instanceof ApiRequestError) {
    if (err.status === 404 || err.errorCode === "not_found") {
      return t("errors.notFound");
    }
    if (err.status === 422 || err.errorCode === "validation_error") {
      return mapValidationMessage(err.message, t) ?? t("errors.validation");
    }
    return t("errors.generic");
  }
  return t("errors.generic");
}
