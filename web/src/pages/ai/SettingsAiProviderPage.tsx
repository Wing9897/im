import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { testAiEngine } from "../../api/system";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { AssistantWebSearchPanel } from "../../components/settings/AssistantWebSearchPanel";
import { LlmSettingsPanel } from "../../components/settings/LlmSettingsPanel";
import { SettingsSaveBar } from "../../components/settings/SettingsSaveBar";
import { Button, FormActions } from "../../components/ui";
import { formHelpClass } from "../../components/ui/pageTypography";
import { useToast } from "../../context/ToastContext";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import { effectiveAssistantLlm } from "../../domain/settings/assistantWebSearchRoute";
import { toErrorMessage } from "../../utils/errors";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";
import { useSettingsPageState } from "../settings/SettingsShared";

export function SettingsAiProviderPage() {
  const { t } = useTranslation("settings");
  const {
    settings,
    settingsObject,
    settingsInitialLoading,
    error: settingsLoadError,
    activeProviderConfig,
    saving,
    saveSuccess,
    hasUnsavedChanges,
    handleSettingChange,
    updateSettings,
    handleSave,
  } = useSettingsPageState();
  const { showToast } = useToast();
  const { requestAiStatusRefresh } = useCollectorStatus();
  const [testing, setTesting] = useState(false);

  const handleTest = useCallback(async () => {
    if (!settingsObject || !activeProviderConfig) {
      return;
    }

    if (!settingsObject.llmBaseUrl.trim()) {
      showToast(activeProviderConfig.fields.emptyBaseUrlMessage, "error");
      return;
    }
    if (!settingsObject.llmModel.trim()) {
      showToast(activeProviderConfig.fields.emptyModelMessage, "error");
      return;
    }

    setTesting(true);
    showToast(t("provider.testingToast"), "info");
    try {
      const result = await testAiEngine({
        llmProvider: settingsObject.llmProvider,
        llmBaseUrl: settingsObject.llmBaseUrl,
        llmModel: settingsObject.llmModel,
        llmApiKey: settingsObject.llmApiKey,
        ollamaThinkingEnabled: settingsObject.ollamaThinkingEnabled,
      });
      if (result.success) {
        const tokens = `${result.promptTokens ?? 0}+${result.completionTokens ?? 0} tokens`;
        const preview = result.preview
          ? t("provider.testPreviewSuffix", { preview: result.preview })
          : "";
        showToast(
          t("provider.testSuccess", {
            latency: result.latencyMs ?? "?",
            tokens,
            preview,
          }),
          "success",
        );
        requestAiStatusRefresh(true);
      } else {
        showToast(result.error ?? t("provider.testFailedDefault"), "error");
      }
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setTesting(false);
    }
  }, [
    activeProviderConfig,
    requestAiStatusRefresh,
    settingsObject,
    showToast,
    t,
  ]);

  if (settingsInitialLoading) {
    return <LoadingSpinner text={t("provider.loading")} />;
  }

  if (!settingsObject || !settings) {
    return (
      <LoadingSpinner text={settingsLoadError ?? t("provider.loadError")} />
    );
  }

  const agentLlm = effectiveAssistantLlm(settings);

  return (
    <SettingsContentCard>
      <LlmSettingsPanel
        llmProvider={settingsObject.llmProvider}
        llmBaseUrl={settingsObject.llmBaseUrl}
        llmModel={settingsObject.llmModel}
        llmApiKey={settingsObject.llmApiKey}
        openaiJsonMode={settingsObject.openaiJsonMode}
        ollamaThinkingEnabled={settingsObject.ollamaThinkingEnabled}
        onLlmProviderChange={(v) => handleSettingChange("llmProvider", v)}
        onLlmBaseUrlChange={(v) => handleSettingChange("llmBaseUrl", v)}
        onLlmModelChange={(v) => handleSettingChange("llmModel", v)}
        onLlmApiKeyChange={(v) => handleSettingChange("llmApiKey", v)}
        onOpenaiJsonModeChange={(v) => handleSettingChange("openaiJsonMode", v)}
        onOllamaThinkingEnabledChange={(v) => handleSettingChange("ollamaThinkingEnabled", v)}
      />

      <SettingsFieldGroup showDivider>
        <AssistantWebSearchPanel
          enabled={settings.assistantWebSearchEnabled}
          provider={settings.webSearchProvider}
          braveApiKey={settings.braveSearchApiKey}
          llmProvider={agentLlm.provider}
          llmBaseUrl={agentLlm.baseUrl}
          onEnabledChange={(value) => updateSettings("assistantWebSearchEnabled", value)}
          onProviderChange={(value) => updateSettings("webSearchProvider", value)}
          onBraveApiKeyChange={(value) => updateSettings("braveSearchApiKey", value)}
        />
      </SettingsFieldGroup>

      <p className={`mb-0 ${formHelpClass}`}>
        {t("provider.testHint")}
        {hasUnsavedChanges ? t("provider.testHintUnsaved") : null}
      </p>

      <FormActions>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleTest()}
          disabled={testing || saving}
        >
          {testing ? t("provider.testing") : t("provider.testButton")}
        </Button>
        <SettingsSaveBar
          inline
          saving={saving}
          saveSuccess={saveSuccess}
          saveLabel={t("provider.saveLabel")}
          onSave={handleSave}
        />
      </FormActions>
    </SettingsContentCard>
  );
}
