import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchMcpStatus } from "../../api/mcp";
import { Button } from "../../components/ui";
import { captionClass, cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import { SettingsFieldGroup, settingsDocsMonoUrlClass } from "./SettingsShared";

type ProbeState = "idle" | "loading" | "ok" | "fail";

type SettingsMcpProbeSectionProps = {
  mcpUrl: string;
};

/** Endpoint URL + session-auth status probe. */
export function SettingsMcpProbeSection({ mcpUrl }: SettingsMcpProbeSectionProps) {
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
    <SettingsFieldGroup>
      <div>
        <h3 className={`m-0 ${cardTitleClass}`}>{t("mcpDocs.endpoint.title")}</h3>
        <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("mcpDocs.endpoint.body")}</p>
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
    </SettingsFieldGroup>
  );
}
