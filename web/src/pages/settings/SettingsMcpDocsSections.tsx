import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";
import { openClawMcpExample } from "../../domain/apiDocs/examples";
import { Button } from "../../components/ui";
import { captionClass, cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import {
  SettingsFieldGroup,
  settingsDocsExamplePreClass,
  settingsDocsLinkClass,
} from "./SettingsShared";

function DocsBulletList({ items }: { items: string[] }) {
  return (
    <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

type SettingsMcpDocsSectionsProps = {
  mcpUrl: string;
};

/** OpenClaw config example + copy (sits above capability toggles). */
export function SettingsMcpOpenClawSection({ mcpUrl }: SettingsMcpDocsSectionsProps) {
  const { t } = useTranslation("settings");
  const openClawExample = openClawMcpExample(mcpUrl);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");

  const onCopyConfig = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(openClawExample);
      setCopyState("ok");
    } catch {
      setCopyState("fail");
    }
  }, [openClawExample]);

  return (
    <SettingsFieldGroup showDivider>
      <div>
        <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.openClaw.title")}</h3>
        <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("mcpDocs.openClaw.body")}</p>
        <div className="mt-sm">
          <div className="mb-1 flex flex-wrap items-center gap-x-md gap-y-xs">
            <div className={`${captionClass} font-medium text-text-primary`}>
              {t("mcpDocs.openClaw.exampleTitle")}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void onCopyConfig()}
              data-testid="mcp-copy-config"
            >
              <Copy size={14} aria-hidden />
              {t("mcpDocs.openClaw.copy")}
            </Button>
            {copyState === "ok" ? (
              <span className={captionClass} data-testid="mcp-copy-ok">
                {t("mcpDocs.openClaw.copied")}
              </span>
            ) : null}
            {copyState === "fail" ? (
              <span className={captionClass} data-testid="mcp-copy-fail">
                {t("mcpDocs.openClaw.copyFailed")}
              </span>
            ) : null}
          </div>
          <pre className={settingsDocsExamplePreClass} data-testid="mcp-docs-example">
            {openClawExample}
          </pre>
        </div>
      </div>
    </SettingsFieldGroup>
  );
}

/** Capability / not-exposed bullets + access-key links (below toggles). */
export function SettingsMcpReferenceDocs() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.capabilities.title")}</h3>
          <DocsBulletList
            items={
              t("mcpDocs.capabilities.items", {
                returnObjects: true,
              }) as string[]
            }
          />
        </div>
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.notExposed.title")}</h3>
          <DocsBulletList
            items={
              t("mcpDocs.notExposed.items", {
                returnObjects: true,
              }) as string[]
            }
          />
        </div>
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.accessKeys.title")}</h3>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("mcpDocs.accessKeys.body")}</p>
          <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
            <Link to="/account/keys" className={settingsDocsLinkClass} data-testid="mcp-link-keys">
              {t("mcpDocs.accessKeys.linkKeys")}
            </Link>
            <Link to="/settings/api" className={settingsDocsLinkClass} data-testid="mcp-link-api">
              {t("mcpDocs.accessKeys.linkApi")}
            </Link>
          </div>
          <p className={`mt-sm mb-0 ${captionClass}`}>{t("mcpDocs.docsHint")}</p>
        </div>
      </SettingsFieldGroup>
    </>
  );
}
