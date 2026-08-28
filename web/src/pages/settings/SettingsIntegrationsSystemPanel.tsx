import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  FormStack,
  PasswordField,
  SettingsRow,
  SurfaceCard,
} from "../../components/ui";
import { useToast } from "../../context/ToastContext";
import {
  CARTO_API_KEY_DOCS_URL,
  SYSTEM_OUTBOUND_APIS,
} from "../../domain/settings/systemOutboundApis";
import { readCartoApiKey, writeCartoApiKey } from "../../domain/intelligence/mapTiles";
import { captionClass, formHelpClass } from "../../components/ui/pageTypography";
import { settingsDocsMonoUrlClass } from "./SettingsShared";

function SystemSectionCard({
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

/** Settings → 外部接口 → 系統 API 及網址: CARTO key + read-only outbound URL list. */
export function SettingsIntegrationsSystemPanel() {
  const { t } = useTranslation("settings");
  const { showToast } = useToast();
  const [cartoApiKey, setCartoApiKey] = useState("");
  const [savingCartoKey, setSavingCartoKey] = useState(false);

  useEffect(() => {
    setCartoApiKey(readCartoApiKey());
  }, []);

  const saveCartoBasemapKey = () => {
    setSavingCartoKey(true);
    try {
      setCartoApiKey(writeCartoApiKey(cartoApiKey));
      showToast(t("integrations.system.cartoApiKeySaved"), "success");
    } finally {
      setSavingCartoKey(false);
    }
  };

  return (
    <FormStack gap="lg">
      <SystemSectionCard
        title={t("integrations.system.cartoApiKeyLabel")}
        testId="integrations-system-carto-card"
      >
        <FormStack gap="md">
          <SettingsRow
            layout="stack"
            label={t("integrations.system.cartoApiKeyLabel")}
            htmlFor="carto-api-key"
          >
            <PasswordField
              id="carto-api-key"
              className="w-full"
              value={cartoApiKey}
              placeholder={t("integrations.system.cartoApiKeyPlaceholder")}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setCartoApiKey(event.target.value)}
              aria-label={t("integrations.system.cartoApiKeyAria")}
              data-testid="carto-api-key"
            />
          </SettingsRow>
          <p className={`m-0 ${formHelpClass}`}>
            {t("integrations.system.cartoApiKeyHelp")}{" "}
            <a
              href={CARTO_API_KEY_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              data-testid="carto-api-key-docs"
            >
              {t("integrations.system.cartoApiKeyLink")}
            </a>
          </p>
          <div className="w-fit">
            <Button
              variant="secondary"
              size="sm"
              disabled={savingCartoKey}
              onClick={saveCartoBasemapKey}
              data-testid="save-carto-api-key"
            >
              {savingCartoKey ? t("shared.saving") : t("integrations.system.saveCartoApiKey")}
            </Button>
          </div>
        </FormStack>
      </SystemSectionCard>

      <SystemSectionCard
        title={t("integrations.system.outboundTitle")}
        testId="integrations-system-outbound-card"
      >
        <FormStack gap="md">
          <p className={`m-0 ${formHelpClass}`}>{t("integrations.system.outboundHelp")}</p>
          <ul
            className="m-0 list-none space-y-md p-0"
            data-testid="integrations-system-outbound-list"
          >
            {SYSTEM_OUTBOUND_APIS.map((entry) => (
              <li key={entry.id} data-testid={`integrations-system-outbound-${entry.id}`}>
                <p className={`m-0 ${captionClass} font-medium text-text-primary`}>
                  {t(`integrations.system.outbound.${entry.labelKey}`)}
                </p>
                {entry.helpKey ? (
                  <p className={`m-0 mt-xs ${formHelpClass}`}>
                    {t(`integrations.system.outbound.${entry.helpKey}`)}
                  </p>
                ) : null}
                <p
                  className={settingsDocsMonoUrlClass}
                  data-testid={`integrations-system-outbound-url-${entry.id}`}
                >
                  {entry.url}
                </p>
                {entry.docsUrl ? (
                  <p className={`m-0 mt-xs ${formHelpClass}`}>
                    <a href={entry.docsUrl} target="_blank" rel="noreferrer">
                      {t("integrations.system.cartoApiKeyLink")}
                    </a>
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </FormStack>
      </SystemSectionCard>
    </FormStack>
  );
}
