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
import {
  buildAssistantLlmDraft,
  draftToAssistantLlmPatch,
  isAssistantLlmFollow,
  normalizeCustomProvider,
  providerConnection,
  type AssistantLlmDraft,
} from "./assistantLlmSettingsDraft";

export { isAssistantLlmFollow };

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
  const [draft, setDraft] = useState<AssistantLlmDraft>(() => buildAssistantLlmDraft(settings));
  const providerOptions = getLlmProviderOptions(t);
  const providerMeta = getLlmProviderConfig(t)[draft.provider];

  useEffect(() => {
    if (open) {
      setDraft(buildAssistantLlmDraft(settings));
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
    void onSave(draftToAssistantLlmPatch(draft));
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
