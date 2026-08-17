import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { resolveBaseUrl } from "../../api/baseUrl";
import { fetchMcpStatus } from "../../api/mcp";
import { openClawMcpExample } from "../../domain/apiDocs/examples";
import { settingsIntegrationsPath } from "../../domain/navigation/integrationsRoutes";
import { Button, CollapsePanel, FormStack, SurfaceCard } from "../../components/ui";
import { captionClass, cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import { SettingsHouseholdCapabilityToggles } from "./SettingsHouseholdCapabilityToggles";
import { IntegrationsAccountKeysLink } from "./SettingsIntegrationsPanels";
import {
  SettingsDocsExample,
  settingsDocsLinkClass,
  settingsDocsMonoUrlClass,
} from "./SettingsShared";

type ProbeState = "idle" | "loading" | "ok" | "fail";

function DocsBulletList({ items }: { items: string[] }) {
  return (
    <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
      {items.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

function McpProbeSection({ mcpUrl }: { mcpUrl: string }) {
  const { t } = useTranslation("settings");
  const [probeState, setProbeState] = useState<ProbeState>("idle");
  const [probeDetail, setProbeDetail] = useState("");

  const onProbe = useCallback(async () => {
    setProbeState("loading");
    setProbeDetail("");
    try {
      const status = await fetchMcpStatus();
      if (!status.enabled) {
        setProbeState("fail");
        setProbeDetail(t("mcpDocs.probe.disabled"));
        return;
      }
      const names = status.tools.map((tool) => tool.name).join(", ");
      setProbeState("ok");
      setProbeDetail(
        t("mcpDocs.probe.success", {
          toolCount: status.toolCount,
          names,
        }),
      );
    } catch {
      setProbeState("fail");
      setProbeDetail(t("mcpDocs.probe.error"));
    }
  }, [t]);

  return (
    <div>
      <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.endpoint.title")}</h3>
      <p className={`mt-xs mb-0 ${captionClass}`}>{t("mcpDocs.endpoint.body")}</p>
      <p className={settingsDocsMonoUrlClass} data-testid="mcp-endpoint-url">
        {mcpUrl}
      </p>
      <div className="mt-sm flex flex-wrap items-center gap-x-md gap-y-xs">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void onProbe()}
          disabled={probeState === "loading"}
          data-testid="mcp-probe-connection"
        >
          {probeState === "loading" ? t("mcpDocs.probe.probing") : t("mcpDocs.probe.button")}
        </Button>
        {probeState === "ok" ? (
          <span className={captionClass} data-testid="mcp-probe-ok">
            {probeDetail}
          </span>
        ) : null}
        {probeState === "fail" ? (
          <span className={captionClass} data-testid="mcp-probe-fail">
            {probeDetail}
          </span>
        ) : null}
      </div>
      <p className={`mt-xs mb-0 ${captionClass}`}>{t("mcpDocs.probe.hint")}</p>
    </div>
  );
}

function McpOpenClawSection({ mcpUrl }: { mcpUrl: string }) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);

  return (
    <CollapsePanel
      title={t("mcpDocs.openClaw.title")}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <p className={`m-0 ${cardBodyClass}`}>{t("mcpDocs.openClaw.body")}</p>
      <SettingsDocsExample
        title={t("mcpDocs.openClaw.exampleTitle")}
        body={openClawMcpExample(mcpUrl)}
        testId="mcp-docs-example"
        copyTestId="mcp-copy-config"
        copiedTestId="mcp-copy-ok"
      />
    </CollapsePanel>
  );
}

function McpReferenceDocs() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);

  return (
    <CollapsePanel
      title={t("mcpDocs.referenceSectionTitle")}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
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

      <div>
        <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.accessKeys.title")}</h3>
        <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("mcpDocs.accessKeys.body")}</p>
        <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
          <Link
            to={settingsIntegrationsPath("a2a")}
            className={settingsDocsLinkClass}
            data-testid="mcp-link-a2a"
          >
            {t("mcpDocs.accessKeys.linkApi")}
          </Link>
        </div>
        <p className={`mt-sm mb-0 ${captionClass}`}>{t("mcpDocs.docsHint")}</p>
      </div>
    </CollapsePanel>
  );
}

/** Settings → 外部接口 → MCP: probe + capability groups; long docs collapsed. */
export function SettingsIntegrationsMcpPanel() {
  const { t } = useTranslation("settings");
  const mcpUrl = `${resolveBaseUrl()}/api/v1/mcp`;

  return (
    <FormStack gap="lg">
      <p className={`m-0 ${captionClass}`}>{t("mcpDocs.intro")}</p>
      <SurfaceCard
        material="panel"
        density="compact"
        role="region"
        aria-label={t("mcpDocs.endpoint.title")}
      >
        <McpProbeSection mcpUrl={mcpUrl} />
        <div className="mt-sm">
          <IntegrationsAccountKeysLink testId="mcp-link-keys" />
        </div>
      </SurfaceCard>
      <SurfaceCard
        material="panel"
        density="compact"
        role="region"
        aria-label={t("mcpDocs.capabilityToggles.title")}
      >
        <SettingsHouseholdCapabilityToggles masterSwitch="mcp" />
      </SurfaceCard>
      <McpOpenClawSection mcpUrl={mcpUrl} />
      <McpReferenceDocs />
    </FormStack>
  );
}
