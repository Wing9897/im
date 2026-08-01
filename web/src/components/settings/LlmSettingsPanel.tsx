import { useTranslation } from "react-i18next";
import {
  CheckboxField,
  FormGrid,
  FormStack,
  PasswordField,
  SelectField,
  SelectTile,
  SelectTileGrid,
  SettingsRow,
  TextField,
} from "../ui";
import type { LlmProvider } from "../../types";
import { getLlmProviderConfig, getLlmProviderOptions } from "../../domain/settings/llmProviderConfig";
import { GeminiBaseUrlField } from "./GeminiBaseUrlField";

interface LlmSettingsPanelProps {
  llmProvider: LlmProvider;
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
  openaiJsonMode: string;
  ollamaThinkingEnabled: boolean;
  onLlmProviderChange: (v: LlmProvider) => void;
  onLlmBaseUrlChange: (v: string) => void;
  onLlmModelChange: (v: string) => void;
  onLlmApiKeyChange: (v: string) => void;
  onOpenaiJsonModeChange: (v: string) => void;
  onOllamaThinkingEnabledChange: (v: boolean) => void;
}

export function LlmSettingsPanel({
  llmProvider,
  llmBaseUrl,
  llmModel,
  llmApiKey,
  openaiJsonMode,
  ollamaThinkingEnabled,
  onLlmProviderChange,
  onLlmBaseUrlChange,
  onLlmModelChange,
  onLlmApiKeyChange,
  onOpenaiJsonModeChange,
  onOllamaThinkingEnabledChange,
}: LlmSettingsPanelProps) {
  const { t } = useTranslation("settings");
  const providerMeta = getLlmProviderConfig(t)[llmProvider];
  const providerOptions = getLlmProviderOptions(t);

  return (
    <FormStack gap="lg">
      <SelectTileGrid>
        {providerOptions.map((opt) => (
          <SelectTile
            key={opt.id}
            compact
            active={llmProvider === opt.id}
            hint={opt.hint}
            onClick={() => onLlmProviderChange(opt.id)}
          >
            {opt.label}
          </SelectTile>
        ))}
      </SelectTileGrid>

      <FormGrid>
        <SettingsRow
          label={providerMeta.baseUrlLabel}
          htmlFor="llm-base-url"
          help={
            llmProvider === "gemini_compatible"
              ? t("llm.baseUrlHelpGemini")
              : undefined
          }
        >
          {llmProvider === "gemini_compatible" ? (
            <GeminiBaseUrlField
              id="llm-base-url"
              value={llmBaseUrl}
              placeholder={providerMeta.baseUrlPlaceholder}
              onChange={onLlmBaseUrlChange}
            />
          ) : (
            <TextField
              id="llm-base-url"
              value={llmBaseUrl}
              onChange={(e) => onLlmBaseUrlChange(e.target.value)}
              placeholder={providerMeta.baseUrlPlaceholder}
            />
          )}
        </SettingsRow>

        <SettingsRow
          label={providerMeta.modelLabel}
          htmlFor="llm-model"
          help={
            llmProvider === "gemini_compatible"
              ? t("llm.modelHelpGemini")
              : undefined
          }
        >
          <TextField
            id="llm-model"
            value={llmModel}
            onChange={(e) => onLlmModelChange(e.target.value)}
            placeholder={providerMeta.modelPlaceholder}
          />
        </SettingsRow>

        <SettingsRow label={t("llm.apiKeyLabel")} htmlFor="llm-api-key">
          <PasswordField
            id="llm-api-key"
            value={llmApiKey}
            onChange={(e) => onLlmApiKeyChange(e.target.value)}
            placeholder={providerMeta.apiKeyPlaceholder}
            aria-label={t("llm.apiKeyLabel")}
          />
        </SettingsRow>
      </FormGrid>

      {llmProvider === "openai_compatible" ? (
        <SettingsRow
          label={t("llm.jsonModeLabel")}
          htmlFor="openai-json-mode"
          help={t("llm.jsonModeHelp")}
        >
          <SelectField
            id="openai-json-mode"
            value={openaiJsonMode}
            onChange={(e) => onOpenaiJsonModeChange(e.target.value)}
          >
            <option value="json_schema">{t("llm.jsonModeSchemaOption")}</option>
            <option value="json_object">{t("llm.jsonModeObjectOption")}</option>
          </SelectField>
        </SettingsRow>
      ) : null}

      {llmProvider === "ollama" ? (
        <SettingsRow label={t("llm.thinkingModeLabel")} help={t("llm.thinkingModeHelp")}>
          <CheckboxField
            id="ollama-thinking-enabled"
            label={ollamaThinkingEnabled ? t("shared.enabled") : t("shared.disabled")}
            checked={ollamaThinkingEnabled}
            onChange={(e) => onOllamaThinkingEnabledChange(e.target.checked)}
            aria-label={t("llm.thinkingModeAria")}
          />
        </SettingsRow>
      ) : null}
    </FormStack>
  );
}
