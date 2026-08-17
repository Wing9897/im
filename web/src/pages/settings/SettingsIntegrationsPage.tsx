import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FormStack, SegmentedControl } from "../../components/ui";
import {
  DEFAULT_INTEGRATION_TAB,
  INTEGRATION_TABS,
  isIntegrationTabKey,
  type IntegrationTabKey,
} from "../../domain/navigation/integrationsRoutes";
import { SettingsIntegrationsMcpPanel } from "./SettingsIntegrationsMcpPanel";
import {
  SettingsIntegrationsA2aPanel,
  SettingsIntegrationsDeeplinkPanel,
  SettingsIntegrationsWebhookPanel,
} from "./SettingsIntegrationsPanels";

/** Settings → 外部接口: in-page pills for Webhook | A2A | 日曆連結 | MCP. */
export function SettingsIntegrationsPage() {
  const { t } = useTranslation("settings");
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (isIntegrationTabKey(searchParams.get("tab"))) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", DEFAULT_INTEGRATION_TAB);
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  const activeTab = useMemo((): IntegrationTabKey => {
    const tab = searchParams.get("tab");
    return isIntegrationTabKey(tab) ? tab : DEFAULT_INTEGRATION_TAB;
  }, [searchParams]);

  const setActiveTab = useCallback(
    (tab: IntegrationTabKey) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("tab", tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  return (
    <FormStack gap="lg">
      <div data-testid="integrations-subtabs">
        <SegmentedControl
          layout="inline"
          ariaLabel={t("integrations.tabsAria")}
          value={activeTab}
          onChange={(id) => setActiveTab(id as IntegrationTabKey)}
          items={INTEGRATION_TABS.map((id) => ({
            id,
            label: t(`integrations.${id}`),
          }))}
        />
      </div>

      {activeTab === "webhook" ? <SettingsIntegrationsWebhookPanel /> : null}
      {activeTab === "a2a" ? <SettingsIntegrationsA2aPanel /> : null}
      {activeTab === "deeplink" ? <SettingsIntegrationsDeeplinkPanel /> : null}
      {activeTab === "mcp" ? <SettingsIntegrationsMcpPanel /> : null}
    </FormStack>
  );
}
