import { useTranslation } from "react-i18next";
import {
  FormGrid,
  FormStack,
  MenuSelect,
  PasswordField,
  SelectTile,
  SelectTileGrid,
  SettingsRow,
  TextField,
} from "../ui";
import type { LlmProvider } from "../../types";
import { getLlmProviderConfig, getLlmProviderOptions } from "../../domain/settings/llmProviderConfig";
import { GeminiBaseUrlField } from "./GeminiBaseUrlField";

interface LlmProfileConnectionPanelProps {
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

/** Provider connection fields for a single ``llm_profiles`` row editor. */
export function LlmProfileConnectionPanel({
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
}: LlmProfileConnectionPanelProps) {
  const { t } = useTranslation("settings");
  const providerMeta = getLlmProviderConfig(t)[llmProvider];
  const providerOptions = getLlmProviderOptions(t);

  return (
    <FormStack gap="lg">
      <SelectTileGrid columns="repeat(auto-fit, minmax(150px, 1fr))" className="gap-md">
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

        {llmProvider === "openai_compatible" ? (
          <SettingsRow
            label={t("llm.jsonModeLabel")}
            htmlFor="openai-json-mode"
            help={t("llm.jsonModeHelp")}
          >
            <MenuSelect
              id="openai-json-mode"
              variant="field"
              menuPortal
              value={openaiJsonMode || "disabled"}
              options={[
                { value: "disabled", label: t("llm.jsonModeDisabledOption") },
                { value: "json_schema", label: t("llm.jsonModeSchemaOption") },
                { value: "json_object", label: t("llm.jsonModeObjectOption") },
              ]}
              onChange={onOpenaiJsonModeChange}
              aria-label={t("llm.jsonModeLabel")}
              data-testid="openai-json-mode"
            />
          </SettingsRow>
        ) : null}

        {llmProvider === "ollama" ? (
          <SelectTile
            compact
            variant="toggle"
            className="max-w-[280px]"
            active={ollamaThinkingEnabled}
            data-testid="ollama-thinking-enabled"
            aria-label={t("llm.thinkingModeAria")}
            title={t("llm.thinkingModeHelp")}
            hint={t("llm.thinkingModeHelp")}
            onClick={() => onOllamaThinkingEnabledChange(!ollamaThinkingEnabled)}
          >
            {t("llm.thinkingModeLabel")}
          </SelectTile>
        ) : null}
      </FormGrid>
    </FormStack>
  );
}
