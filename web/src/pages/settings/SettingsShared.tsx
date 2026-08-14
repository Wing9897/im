import { captionClass } from "../../components/ui/pageTypography";
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

/** Shared chrome for Settings API / MCP docs pages (links + code samples). */
export const settingsDocsLinkClass = `${captionClass} font-medium text-accent no-underline hover:underline`;
export const settingsDocsExamplePreClass =
  "im-auto-scrollbar m-0 max-h-[min(360px,45vh)] overflow-auto whitespace-pre-wrap break-words rounded-md bg-[rgba(17,17,27,0.5)] px-3 py-2.5 text-[11px] leading-snug text-text-secondary";
/** Mono block for resolved API / MCP endpoint URLs (shared with ResolvedApiBaseUrl). */
export { resolvedApiBaseUrlClass as settingsDocsMonoUrlClass } from "../../components/settings/ResolvedApiBaseUrl";

export function SettingsDocsExample({
  title,
  body,
  testId = "api-docs-example",
}: {
  title: string;
  body: string;
  testId?: string;
}) {
  return (
    <div className="mt-sm">
      <div className={`mb-1 ${captionClass} font-medium text-text-primary`}>{title}</div>
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
