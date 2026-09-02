import { useState } from "react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";
import { captionClass } from "../../components/ui/pageTypography";
import { aiWorkspaceNavItems } from "../../domain/navigation/workspaceNav";
import { settingsTabItems } from "../shared/WorkspaceShell";
import { createWorkspacePage } from "../shared/createWorkspacePage";

/**
 * Settings shell + docs chrome. Shared form surfaces live in
 * ``components/settings/SettingsFormLayout`` and the outlet accessor in
 * ``components/settings/useSettingsPageState`` — import those directly from
 * account / logs / ai (and any non-settings feature).
 */
export {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";

/** Shared chrome for Settings integrations docs pages (links + code samples). */
export const settingsDocsLinkClass = `${captionClass} font-medium text-accent no-underline hover:underline`;
export const settingsDocsExamplePreClass =
  "im-auto-scrollbar m-0 max-h-[min(360px,45vh)] overflow-auto whitespace-pre-wrap break-words rounded-md bg-[rgba(17,17,27,0.5)] px-3 py-2.5 text-[11px] leading-snug text-text-secondary";
/** Mono block for resolved API / MCP endpoint URLs (shared with ResolvedApiBaseUrl). */
export { resolvedApiBaseUrlClass as settingsDocsMonoUrlClass } from "../../components/settings/ResolvedApiBaseUrl";

export function SettingsDocsExample({
  title,
  body,
  testId = "api-docs-example",
  copyTestId,
  copiedTestId,
}: {
  title: string;
  body: string;
  testId?: string;
  copyTestId?: string;
  copiedTestId?: string;
}) {
  const { t } = useTranslation("settings");
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  return (
    <div className="mt-sm">
      <div className="mb-1 flex flex-wrap items-center gap-x-md gap-y-xs">
        <div className={`${captionClass} font-medium text-text-primary`}>{title}</div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            void navigator.clipboard.writeText(body).then(
              () => setCopyState("ok"),
              () => setCopyState("fail"),
            );
          }}
          data-testid={copyTestId ?? `${testId}-copy`}
        >
          <Copy size={14} aria-hidden />
          {t("integrations.copy")}
        </Button>
        {copyState === "ok" ? (
          <span className={captionClass} data-testid={copiedTestId}>
            {t("integrations.copied")}
          </span>
        ) : null}
        {copyState === "fail" ? (
          <span className={captionClass}>{t("integrations.copyFailed")}</span>
        ) : null}
      </div>
      <pre className={settingsDocsExamplePreClass} data-testid={testId}>
        {body}
      </pre>
    </div>
  );
}

export const SettingsShellPage = createWorkspacePage(
  settingsTabItems,
  "shell.systemSettingsSection",
);

/** AI tabs under `/settings/ai/*` — same SystemSettingsLayout as system settings. */
export const SettingsAiShellPage = createWorkspacePage(
  aiWorkspaceNavItems,
  "shell.aiSettingsSection",
);
