import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../ModalDialog";
import { GeminiBaseUrlField } from "../settings/GeminiBaseUrlField";
import {
  Button,
  CheckboxField,
  FormGrid,
  FormStack,
  PasswordField,
  SelectTile,
  SelectTileGrid,
  SettingsRow,
  TextField,
} from "../ui";
import { getLlmProviderConfig, getLlmProviderOptions } from "../../domain/settings/llmProviderConfig";
import type { LlmProvider, SystemSettingsSnapshot } from "../../types";

const FOLLOW_PROVIDER_VALUE = "";

export function isAssistantLlmFollow(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return !trimmed || trimmed === "follow";
}

function normalizeCustomProvider(
  value: string | undefined,
  fallback: LlmProvider,
): LlmProvider {
  const trimmed = (value ?? "").trim();
  if (
    trimmed === "ollama" ||
    trimmed === "openai_compatible" ||
    trimmed === "gemini_compatible" ||
    trimmed === "openrouter"
  ) {
    return trimmed;
  }
  return fallback;
}

function providerConnection(
  settings: SystemSettingsSnapshot,
  provider: LlmProvider,
): { baseUrl: string; model: string; apiKey: string } {
  const fields = getLlmProviderConfig()[provider];
  return {
    baseUrl: String(settings[fields.baseUrlKey] ?? ""),
    model: String(settings[fields.modelKey] ?? ""),
    apiKey: fields.apiKeyKey ? String(settings[fields.apiKeyKey] ?? "") : "",
  };
}

type Draft = {
  follow: boolean;
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  historyMaxMessages: string;
  historyMaxChars: string;
};

function buildDraft(settings: SystemSettingsSnapshot): Draft {
  const follow = isAssistantLlmFollow(settings.assistantLlmProvider);
  const provider = follow
    ? settings.llmProvider
    : normalizeCustomProvider(settings.assistantLlmProvider, settings.llmProvider);
  const global = providerConnection(settings, provider);
  const historyMaxMessages = settings.agentHistoryMaxMessages.trim() || "40";
  const historyMaxChars = settings.agentHistoryMaxChars.trim() || "48000";
  if (follow) {
    return {
      follow: true,
      provider,
      baseUrl: global.baseUrl,
      model: global.model,
      apiKey: global.apiKey,
      historyMaxMessages,
      historyMaxChars,
    };
  }
  return {
    follow: false,
    provider,
    baseUrl: settings.assistantLlmBaseUrl.trim() || global.baseUrl,
    model: settings.assistantLlmModel.trim() || global.model,
    apiKey: settings.assistantLlmApiKey.trim() || global.apiKey,
    historyMaxMessages,
    historyMaxChars,
  };
}

type AssistantLlmSettingsDialogProps = {
  open: boolean;
  settings: SystemSettingsSnapshot;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<SystemSettingsSnapshot>) => void | Promise<void>;
};

export function AssistantLlmSettingsDialog({
  open,
  settings,
  saving,
  onClose,
  onSave,
}: AssistantLlmSettingsDialogProps) {
  const { t } = useTranslation("settings");
  const [draft, setDraft] = useState<Draft>(() => buildDraft(settings));
  const providerOptions = getLlmProviderOptions(t);
  const providerMeta = getLlmProviderConfig(t)[draft.provider];

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(settings));
    }
  }, [open, settings]);

  const setFollow = (follow: boolean) => {
    setDraft((prev) => {
      if (follow) {
        const global = providerConnection(settings, settings.llmProvider);
        return {
          follow: true,
          provider: settings.llmProvider,
          baseUrl: global.baseUrl,
          model: global.model,
          apiKey: global.apiKey,
          historyMaxMessages: prev.historyMaxMessages,
          historyMaxChars: prev.historyMaxChars,
        };
      }
      const provider = normalizeCustomProvider(
        settings.assistantLlmProvider,
        settings.llmProvider,
      );
      const global = providerConnection(settings, provider);
      const baseUrl = settings.assistantLlmBaseUrl.trim() || global.baseUrl;
      const model = settings.assistantLlmModel.trim() || global.model;
      const apiKey = settings.assistantLlmApiKey.trim() || global.apiKey;
      return {
        follow: false,
        provider,
        baseUrl,
        model,
        apiKey,
        historyMaxMessages: prev.historyMaxMessages,
        historyMaxChars: prev.historyMaxChars,
      };
    });
  };

  const setProvider = (provider: LlmProvider) => {
    setDraft((prev) => {
      const global = providerConnection(settings, provider);
      const fieldsEmpty = !prev.baseUrl.trim() && !prev.model.trim() && !prev.apiKey.trim();
      return {
        ...prev,
        follow: false,
        provider,
        baseUrl: fieldsEmpty ? global.baseUrl : prev.baseUrl,
        model: fieldsEmpty ? global.model : prev.model,
        apiKey: fieldsEmpty ? global.apiKey : prev.apiKey,
      };
    });
  };

  const handleSave = () => {
    const historyPatch = {
      agentHistoryMaxMessages: draft.historyMaxMessages.trim() || "40",
      agentHistoryMaxChars: draft.historyMaxChars.trim() || "48000",
    };
    if (draft.follow) {
      void onSave({ assistantLlmProvider: FOLLOW_PROVIDER_VALUE, ...historyPatch });
      return;
    }
    void onSave({
      assistantLlmProvider: draft.provider,
      assistantLlmBaseUrl: draft.baseUrl,
      assistantLlmModel: draft.model,
      assistantLlmApiKey: draft.apiKey,
      ...historyPatch,
    });
  };

  return (
    <ModalDialog
      open={open}
      title={t("staff.llmDialogTitle")}
      onClose={onClose}
      size="wide"
      testId="assistant-llm-dialog"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("staff.llmDialogCancel")}
          </Button>
          <Button type="button" variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? t("shared.saving") : t("staff.llmDialogSave")}
          </Button>
        </>
      }
    >
      <FormStack gap="lg">
        <SettingsRow label={t("staff.llmProviderFollow")} help={t("staff.llmProviderHelp")}>
          <CheckboxField
            id="assistant-llm-follow"
            data-testid="assistant-llm-follow"
            label={draft.follow ? t("shared.enabled") : t("shared.disabled")}
            checked={draft.follow}
            onChange={(e) => setFollow(e.target.checked)}
            aria-label={t("staff.llmProviderFollow")}
          />
        </SettingsRow>

        {!draft.follow ? (
          <>
            <SelectTileGrid>
              {providerOptions.map((opt) => (
                <SelectTile
                  key={opt.id}
                  compact
                  active={draft.provider === opt.id}
                  hint={opt.hint}
                  onClick={() => setProvider(opt.id)}
                >
                  {opt.label}
                </SelectTile>
              ))}
            </SelectTileGrid>

            <FormGrid>
              <SettingsRow label={providerMeta.baseUrlLabel} htmlFor="assistant-llm-base-url">
                {draft.provider === "gemini_compatible" ? (
                  <GeminiBaseUrlField
                    id="assistant-llm-base-url"
                    value={draft.baseUrl}
                    placeholder={providerMeta.baseUrlPlaceholder}
                    onChange={(v) => setDraft((prev) => ({ ...prev, baseUrl: v }))}
                  />
                ) : (
                  <TextField
                    id="assistant-llm-base-url"
                    data-testid="assistant-llm-base-url"
                    value={draft.baseUrl}
                    onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
                    placeholder={providerMeta.baseUrlPlaceholder}
                  />
                )}
              </SettingsRow>

              <SettingsRow label={providerMeta.modelLabel} htmlFor="assistant-llm-model">
                <TextField
                  id="assistant-llm-model"
                  data-testid="assistant-llm-model"
                  value={draft.model}
                  onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                  placeholder={providerMeta.modelPlaceholder}
                />
              </SettingsRow>

              <SettingsRow label={t("llm.apiKeyLabel")} htmlFor="assistant-llm-api-key">
                <PasswordField
                  id="assistant-llm-api-key"
                  data-testid="assistant-llm-api-key"
                  value={draft.apiKey}
                  onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder={providerMeta.apiKeyPlaceholder}
                  aria-label={t("llm.apiKeyLabel")}
                />
              </SettingsRow>
            </FormGrid>
          </>
        ) : null}

        <FormGrid>
          <SettingsRow
            label={t("staff.historyMaxMessagesLabel")}
            htmlFor="assistant-history-max-messages"
            help={t("staff.historyMaxMessagesHelp")}
          >
            <TextField
              id="assistant-history-max-messages"
              data-testid="assistant-history-max-messages"
              inputMode="numeric"
              value={draft.historyMaxMessages}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, historyMaxMessages: e.target.value }))
              }
            />
          </SettingsRow>
          <SettingsRow
            label={t("staff.historyMaxCharsLabel")}
            htmlFor="assistant-history-max-chars"
            help={t("staff.historyMaxCharsHelp")}
          >
            <TextField
              id="assistant-history-max-chars"
              data-testid="assistant-history-max-chars"
              inputMode="numeric"
              value={draft.historyMaxChars}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, historyMaxChars: e.target.value }))
              }
            />
          </SettingsRow>
        </FormGrid>
      </FormStack>
    </ModalDialog>
  );
}
