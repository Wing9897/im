import { useTranslation } from "react-i18next";
import { resolveBaseUrl } from "../../api/baseUrl";
import { captionClass, formHelpClass } from "../ui/pageTypography";

/** Mono block for the active API origin (Settings API / Account keys / MCP). */
export const resolvedApiBaseUrlClass =
  "mt-sm mb-0 break-all rounded-md bg-[rgba(17,17,27,0.5)] px-3 py-2.5 font-mono text-[12px] leading-snug text-text-primary";

type ResolvedApiBaseUrlProps = {
  /** i18n namespace for title/body keys (default: settings). */
  ns?: "settings" | "common";
  titleKey: string;
  bodyKey?: string;
  testId?: string;
};

/**
 * Shows the runtime API origin from ``resolveBaseUrl`` (custom server /
 * Vite env / window.origin / default loopback).
 */
export function ResolvedApiBaseUrl({
  ns = "settings",
  titleKey,
  bodyKey,
  testId = "resolved-api-base-url",
}: ResolvedApiBaseUrlProps) {
  const { t } = useTranslation(ns);
  const baseUrl = resolveBaseUrl();

  return (
    <div>
      <p className={`m-0 ${captionClass} font-medium text-text-primary`}>{t(titleKey)}</p>
      {bodyKey ? <p className={`mb-0 mt-xs max-w-[56ch] ${formHelpClass}`}>{t(bodyKey)}</p> : null}
      <p className={resolvedApiBaseUrlClass} data-testid={testId}>
        {baseUrl}
      </p>
    </div>
  );
}
