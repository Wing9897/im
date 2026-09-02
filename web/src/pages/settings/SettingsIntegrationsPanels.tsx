import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  a2aAgentExample,
  calendarDeepLinkExamples,
  webhookIngestExample,
} from "../../domain/apiDocs/examples";
import { ResolvedApiBaseUrl } from "../../components/settings/ResolvedApiBaseUrl";
import { CollapsePanel, FormStack, SurfaceCard } from "../../components/ui";
import { SettingsHouseholdCapabilityToggles } from "./SettingsHouseholdCapabilityToggles";
import { captionClass, cardTitleClass } from "../../components/ui/pageTypography";
import {
  SettingsDocsExample,
  settingsDocsLinkClass,
  settingsDocsMonoUrlClass,
} from "./SettingsShared";

function IntegrationsSectionCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard
      material="panel"
      density="compact"
      role="region"
      aria-label={title}
      data-testid={testId}
    >
      {children}
    </SurfaceCard>
  );
}

export function IntegrationsAccountKeysLink({ testId }: { testId: string }) {
  const { t } = useTranslation("settings");
  return (
    <Link to="/account/keys" className={settingsDocsLinkClass} data-testid={testId}>
      {t("integrations.linkKeys")}
    </Link>
  );
}

function CollapsedExample({
  title,
  body,
  testId,
}: {
  title: string;
  body: string;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CollapsePanel nested title={title} open={open} onToggle={() => setOpen((value) => !value)}>
      <SettingsDocsExample title={title} body={body} testId={testId} />
    </CollapsePanel>
  );
}

function CollapsedReference({
  title,
  items,
  hint,
}: {
  title: string;
  items: string[];
  hint: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <CollapsePanel nested title={title} open={open} onToggle={() => setOpen((value) => !value)}>
      <ul className={`m-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
        {items.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className={`mb-0 mt-sm ${captionClass}`}>{hint}</p>
    </CollapsePanel>
  );
}

export function SettingsIntegrationsWebhookPanel() {
  const { t } = useTranslation("settings");
  const example = webhookIngestExample(t);
  const title = t("apiDocs.webhook.title");

  return (
    <FormStack gap="lg">
      <IntegrationsSectionCard title={t("apiDocs.baseUrl.title")} testId="integrations-webhook-origin">
        <ResolvedApiBaseUrl
          titleKey="apiDocs.baseUrl.title"
          bodyKey="apiDocs.baseUrl.body"
          testId="api-docs-base-url"
        />
      </IntegrationsSectionCard>
      <IntegrationsSectionCard title={title} testId="integrations-webhook-docs">
        <h3 className={`m-0 ${cardTitleClass}`}>{title}</h3>
        <p className={`mt-xs mb-0 ${captionClass}`}>{t("apiDocs.webhook.body")}</p>
        <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
          <IntegrationsAccountKeysLink testId="integrations-webhook-link-keys" />
          <Link
            to="/sources?tab=http&mode=webhook"
            className={settingsDocsLinkClass}
            data-testid="integrations-webhook-link-sources"
          >
            {t("apiDocs.webhook.linkSources")}
          </Link>
        </div>
        <div className="mt-sm">
          <CollapsedExample
            title={t("apiDocs.webhook.exampleTitle")}
            body={example}
            testId="api-docs-example"
          />
        </div>
      </IntegrationsSectionCard>
    </FormStack>
  );
}

export function SettingsIntegrationsA2aPanel() {
  const { t, i18n } = useTranslation("settings");
  const example = a2aAgentExample(t, i18n.language);
  const title = t("apiDocs.liaison.title");

  return (
    <FormStack gap="lg">
      <IntegrationsSectionCard title={t("apiDocs.baseUrl.title")} testId="integrations-a2a-origin">
        <ResolvedApiBaseUrl
          titleKey="apiDocs.baseUrl.title"
          bodyKey="apiDocs.baseUrl.body"
          testId="api-docs-base-url"
        />
      </IntegrationsSectionCard>
      <IntegrationsSectionCard title={title} testId="integrations-a2a-docs">
        <h3 className={`m-0 ${cardTitleClass}`}>{title}</h3>
        <p className={`mt-xs mb-0 ${captionClass}`}>{t("apiDocs.liaison.body")}</p>
        <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
          <IntegrationsAccountKeysLink testId="integrations-a2a-link-keys" />
          <Link to="/settings/ai/staff" className={settingsDocsLinkClass} data-testid="integrations-a2a-link-staff">
            {t("apiDocs.liaison.linkStaff")}
          </Link>
        </div>
        <div className="mt-sm">
          <CollapsedExample
            title={t("apiDocs.liaison.exampleAgent")}
            body={example}
            testId="api-docs-example"
          />
        </div>
        <div className="mt-sm">
          <CollapsedReference
            title={t("integrations.referenceTitle")}
            items={
              t("apiDocs.liaison.capabilities", {
                returnObjects: true,
              }) as string[]
            }
            hint={t("apiDocs.liaison.docsHint")}
          />
        </div>
      </IntegrationsSectionCard>
      <SurfaceCard
        material="panel"
        density="compact"
        role="region"
        aria-label={t("mcpDocs.capabilityToggles.title")}
      >
        <SettingsHouseholdCapabilityToggles masterSwitch="a2a" />
      </SurfaceCard>
    </FormStack>
  );
}

export function SettingsIntegrationsDeeplinkPanel() {
  const { t } = useTranslation("settings");
  const example = calendarDeepLinkExamples(t);
  const title = t("apiDocs.deepLink.title");

  return (
    <FormStack gap="lg">
      <IntegrationsSectionCard title={t("apiDocs.deepLink.originTitle")} testId="integrations-deeplink-origin">
        <p className={`m-0 ${captionClass} font-medium text-text-primary`}>
          {t("apiDocs.deepLink.originTitle")}
        </p>
        <p className={`mb-0 mt-xs ${captionClass}`}>{t("apiDocs.deepLink.originBody")}</p>
        <p className={settingsDocsMonoUrlClass} data-testid="integrations-deeplink-url">
          intelligencemonitor://
        </p>
      </IntegrationsSectionCard>
      <IntegrationsSectionCard title={title} testId="integrations-deeplink-docs">
        <h3 className={`m-0 ${cardTitleClass}`}>{title}</h3>
        <p className={`mt-xs mb-0 ${captionClass}`}>{t("apiDocs.deepLink.body")}</p>
        <div className="mt-sm">
          <CollapsedExample
            title={t("apiDocs.deepLink.exampleBlockTitle")}
            body={example}
            testId="api-docs-example"
          />
        </div>
        <div className="mt-sm">
          <CollapsedReference
            title={t("integrations.referenceTitle")}
            items={
              t("apiDocs.deepLink.capabilities", {
                returnObjects: true,
              }) as string[]
            }
            hint={t("apiDocs.deepLink.docsHint")}
          />
        </div>
      </IntegrationsSectionCard>
    </FormStack>
  );
}
