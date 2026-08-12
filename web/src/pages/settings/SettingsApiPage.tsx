import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  a2aAgentExample,
  calendarDeepLinkExamples,
  webhookIngestExample,
} from "../../domain/apiDocs/examples";
import { ResolvedApiBaseUrl } from "../../components/settings/ResolvedApiBaseUrl";
import { captionClass, cardBodyClass, cardTitleClass } from "../../components/ui/pageTypography";
import {
  SettingsContentCard,
  SettingsDocsExample,
  SettingsFieldGroup,
  settingsDocsLinkClass,
} from "./SettingsShared";

export function SettingsApiPage() {
  const { t, i18n } = useTranslation("settings");
  const webhookExample = webhookIngestExample(t);
  const liaisonExample = a2aAgentExample(t, i18n.language);
  const deepLinkExample = calendarDeepLinkExamples(t);

  return (
    <SettingsContentCard>
      <p className={`m-0 ${cardBodyClass}`}>{t("apiDocs.intro")}</p>

      <SettingsFieldGroup>
        <ResolvedApiBaseUrl
          titleKey="apiDocs.baseUrl.title"
          bodyKey="apiDocs.baseUrl.body"
          testId="api-docs-base-url"
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("apiDocs.accessKeys.title")}</h3>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("apiDocs.accessKeys.body")}</p>
          <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
            <Link to="/account/keys" className={settingsDocsLinkClass}>
              {t("apiDocs.accessKeys.linkKeys")}
            </Link>
          </div>
        </div>
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("apiDocs.webhook.title")}</h3>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("apiDocs.webhook.body")}</p>
          <SettingsDocsExample title={t("apiDocs.webhook.exampleTitle")} body={webhookExample} />
          <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
            <Link to="/account/keys" className={settingsDocsLinkClass}>
              {t("apiDocs.webhook.linkKeys")}
            </Link>
            <Link to="/sources?tab=http&mode=webhook" className={settingsDocsLinkClass}>
              {t("apiDocs.webhook.linkSources")}
            </Link>
          </div>
        </div>
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("apiDocs.liaison.title")}</h3>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("apiDocs.liaison.body")}</p>
          <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
            {(
              t("apiDocs.liaison.capabilities", {
                returnObjects: true,
              }) as string[]
            ).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <SettingsDocsExample title={t("apiDocs.liaison.exampleAgent")} body={liaisonExample} />
          <div className="mt-sm flex flex-wrap gap-x-md gap-y-xs">
            <Link to="/ai/staff" className={settingsDocsLinkClass}>
              {t("apiDocs.liaison.linkStaff")}
            </Link>
            <Link to="/account/keys" className={settingsDocsLinkClass}>
              {t("apiDocs.liaison.linkKeys")}
            </Link>
          </div>
          <p className={`mt-sm mb-0 ${captionClass}`}>{t("apiDocs.liaison.docsHint")}</p>
        </div>
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <div>
          <h3 className={`m-0 ${cardTitleClass}`}>{t("apiDocs.deepLink.title")}</h3>
          <p className={`mt-xs mb-0 ${cardBodyClass}`}>{t("apiDocs.deepLink.body")}</p>
          <ul className={`mt-xs mb-0 list-disc space-y-0.5 pl-4 ${captionClass}`}>
            {(
              t("apiDocs.deepLink.capabilities", {
                returnObjects: true,
              }) as string[]
            ).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <SettingsDocsExample
            title={t("apiDocs.deepLink.exampleBlockTitle")}
            body={deepLinkExample}
          />
          <p className={`mt-sm mb-0 ${captionClass}`}>{t("apiDocs.deepLink.docsHint")}</p>
        </div>
      </SettingsFieldGroup>
    </SettingsContentCard>
  );
}
