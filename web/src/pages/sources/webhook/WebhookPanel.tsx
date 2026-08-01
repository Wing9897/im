import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { sectionTitleClass } from "../../../components/ui/pageTypography";
import { useWebhookPanel } from "./useWebhookPanel";
import { WebhookAccessKeysNotice } from "./WebhookAccessKeysNotice";
import { SourceBoardShell } from "../SourceBoardShell";
import { useErrorToast } from "../../../hooks/useErrorToast";

interface WebhookServiceInfoProps {
  serviceBaseUrl: string;
  servicePort: string;
}

function WebhookServiceInfo({ serviceBaseUrl, servicePort }: WebhookServiceInfoProps) {
  const { t } = useTranslation("sources");
  return (
    <div className="mb-2.5 flex flex-col gap-1">
      <div className="text-body text-text-secondary">
        {t("webhook.serviceUrl")}
        <code className="text-text-primary">{serviceBaseUrl}</code>
      </div>
      <div className="text-xs leading-normal text-text-muted">
        {t("webhook.portShared", { port: servicePort })}
      </div>
    </div>
  );
}

function WebhookExamplesPointer() {
  const { t } = useTranslation("sources");
  return (
    <div className="m-0 rounded-none border-none bg-transparent">
      <div className="mb-1.5 text-xs font-semibold text-text-primary">{t("webhook.examplesTitle")}</div>
      <div className="mb-2 text-xs leading-normal text-text-secondary">
        {t("webhook.examplesBody")}
      </div>
      <div className="mb-2.5 text-xs leading-normal text-text-muted">
        {t("webhook.aiGlobalPrefix")}{" "}
        <a href="/settings/data" className="text-info no-underline">
          {t("webhook.aiGlobalLink")}
        </a>{" "}
        {t("webhook.aiGlobalSuffix")}
      </div>
      <Link
        to="/settings/api"
        className="text-xs font-medium text-accent no-underline hover:underline"
        data-testid="webhook-api-docs-link"
      >
        {t("webhook.openApiDocs")}
      </Link>
    </div>
  );
}

export function WebhookPanel({ modeToggle }: { modeToggle?: ReactNode }) {
  const { t } = useTranslation("sources");
  const { keyCount, servicePort, serviceBaseUrl, error, isConfigured } = useWebhookPanel();
  useErrorToast(error);

  return (
    <SourceBoardShell
        form={
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent px-lg py-md pb-lg"
            aria-label={t("webhook.panelAria")}
          >
            <h2 className={`shrink-0 ${sectionTitleClass}`}>{t("webhook.title")}</h2>
            <p className="mt-1 shrink-0 text-caption leading-snug text-text-muted">
              {t("webhook.intro")}
            </p>

            <div className="mt-md flex min-h-0 flex-1 flex-col">
              <div className="shrink-0">
                <WebhookServiceInfo serviceBaseUrl={serviceBaseUrl} servicePort={servicePort} />
                <WebhookAccessKeysNotice keyCount={keyCount} isConfigured={isConfigured} />
              </div>
            </div>
          </section>
        }
        list={
          <section className="flex min-h-full min-w-0 flex-1 flex-col" aria-label={t("webhook.examplesSectionAria")}>
            <div className="flex flex-wrap items-center justify-between gap-md border-b border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] px-lg py-md">
              <div className="flex min-w-0 items-center gap-sm">
                <h2 className={sectionTitleClass}>{t("webhook.examplesHeading")}</h2>
              </div>
              {modeToggle ? <div className="shrink-0">{modeToggle}</div> : null}
            </div>
            <div className="min-w-0 flex-1 px-lg py-md pb-lg">
              <WebhookExamplesPointer />
            </div>
          </section>
        }
      />
  );
}
