import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ModalDialog } from "../ModalDialog";
import { AssistantWebSearchPanel } from "../settings/AssistantWebSearchPanel";
import { LlmProfileConnectionPanel } from "../settings/LlmProfileConnectionPanel";
import {
  Button,
  CheckboxField,
  FormDialogSection,
  FormStack,
  SettingsRow,
  TextField,
} from "../ui";
import { formHelpClass } from "../ui/pageTypography";
import {
  KEYED_WEB_SEARCH_TOOL_PROVIDERS,
  emptyKeyedWebSearchApiKeyFields,
  keyedWebSearchApiKeyField,
  keyedWebSearchApiKeysFromFields,
  normalizeWebSearchProviderSetting,
  type KeyedWebSearchApiKeyField,
} from "../../domain/settings/assistantWebSearchRoute";
import {
  baseUrlAfterProviderChange,
  DEFAULT_PROVIDER_BASE_URLS,
  getLlmProviderConfig,
  normalizeLlmProvider,
} from "../../domain/settings/llmProviderConfig";
import type { LlmProvider } from "../../types";
import type {
  LlmProfile,
  LlmProfileUpsert,
  LlmStaffClass,
  LlmWebSearchProvider,
} from "../../types/llmProfiles";
import {
  LLM_TASK_STAFF_CLASSES,
  isMaskedSecret,
  normalizeTaskStaffClasses,
} from "../../types/llmProfiles";

type LlmProfileDraftCore = {
  name: string;
  provider: LlmProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  thinkingEnabled: boolean;
  jsonMode: string;
  webSearchEnabled: boolean;
  webSearchProvider: LlmWebSearchProvider;
  staffClasses: LlmStaffClass[];
};

export type LlmProfileDraft = LlmProfileDraftCore & Record<KeyedWebSearchApiKeyField, string>;

export function emptyProfileDraft(): LlmProfileDraft {
  return {
    name: "",
    provider: "ollama",
    baseUrl: DEFAULT_PROVIDER_BASE_URLS.ollama,
    model: "",
    apiKey: "",
    thinkingEnabled: false,
    jsonMode: "disabled",
    webSearchEnabled: true,
    webSearchProvider: "auto",
    ...emptyKeyedWebSearchApiKeyFields(),
    staffClasses: [],
  };
}

export function profileToDraft(profile: LlmProfile): LlmProfileDraft {
  const provider = normalizeLlmProvider(String(profile.provider));
  const webProvider = profile.webSearchProvider;
  const searchKeys = Object.fromEntries(
    KEYED_WEB_SEARCH_TOOL_PROVIDERS.map((vendor) => {
      const field = keyedWebSearchApiKeyField(vendor);
      return [field, profile[field]];
    }),
  ) as Record<KeyedWebSearchApiKeyField, string>;
  return {
    name: profile.name,
    provider,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey: profile.apiKey,
    thinkingEnabled: profile.thinkingEnabled,
    jsonMode: profile.jsonMode || "disabled",
    webSearchEnabled: profile.webSearchEnabled,
    webSearchProvider: normalizeWebSearchProviderSetting(webProvider),
    ...searchKeys,
    staffClasses: normalizeTaskStaffClasses(profile.staffClasses),
  };
}

/** Build upsert body; omit masked secrets so the server keeps stored values. */
export function draftToUpsertBody(draft: LlmProfileDraft): LlmProfileUpsert {
  const body: LlmProfileUpsert = {
    name: draft.name.trim(),
    provider: draft.provider,
    baseUrl: draft.baseUrl.trim(),
    model: draft.model.trim(),
    thinkingEnabled: draft.thinkingEnabled,
    jsonMode: draft.jsonMode || "disabled",
    webSearchEnabled: draft.webSearchEnabled,
    webSearchProvider: draft.webSearchProvider,
    staffClasses: [...draft.staffClasses],
  };
  if (!isMaskedSecret(draft.apiKey)) {
    body.apiKey = draft.apiKey;
  }
  for (const vendor of KEYED_WEB_SEARCH_TOOL_PROVIDERS) {
    const field = keyedWebSearchApiKeyField(vendor);
    const value = draft[field];
    if (!isMaskedSecret(value)) {
      body[field] = value;
    }
  }
  return body;
}

type LlmProfileEditorDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initial: LlmProfileDraft;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: LlmProfileDraft) => void | Promise<void>;
};

export function LlmProfileEditorDialog({
  open,
  mode,
  initial,
  saving,
  onClose,
  onSave,
}: LlmProfileEditorDialogProps) {
  const { t } = useTranslation("settings");
  const [draft, setDraft] = useState<LlmProfileDraft>(initial);

  useEffect(() => {
    if (open) {
      setDraft(initial);
    }
  }, [open, initial]);

  const toggleStaffClass = (staffClass: LlmStaffClass, checked: boolean) => {
    setDraft((prev) => {
      const next = new Set(prev.staffClasses);
      if (checked) next.add(staffClass);
      else next.delete(staffClass);
      return {
        ...prev,
        staffClasses: LLM_TASK_STAFF_CLASSES.filter((c) => next.has(c)),
      };
    });
  };

  return (
    <ModalDialog
      open={open}
      title={mode === "create" ? t("profiles.dialogCreateTitle") : t("profiles.dialogEditTitle")}
      onClose={onClose}
      size="form"
      testId="llm-profile-editor-dialog"
      bodyClassName="flex flex-col gap-lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            {t("profiles.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void onSave(draft)}
            disabled={saving || !draft.name.trim()}
          >
            {saving ? t("shared.saving") : t("profiles.save")}
          </Button>
        </>
      }
    >
      <FormStack gap="xl">
        <FormDialogSection title={t("profiles.sectionIdentity")}>
          <SettingsRow
            label={t("profiles.nameLabel")}
            htmlFor="llm-profile-name"
            help={t("profiles.nameHelp")}
          >
            <TextField
              id="llm-profile-name"
              data-testid="llm-profile-name"
              value={draft.name}
              onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder={t("profiles.namePlaceholder")}
            />
          </SettingsRow>
        </FormDialogSection>

        <FormDialogSection title={t("profiles.sectionConnection")}>
          <LlmProfileConnectionPanel
            llmProvider={draft.provider}
            llmBaseUrl={draft.baseUrl}
            llmModel={draft.model}
            llmApiKey={draft.apiKey}
            openaiJsonMode={draft.jsonMode}
            ollamaThinkingEnabled={draft.thinkingEnabled}
            onLlmProviderChange={(v) =>
              setDraft((prev) =>
                v === prev.provider
                  ? prev
                  : {
                      ...prev,
                      provider: v,
                      baseUrl: baseUrlAfterProviderChange(prev.baseUrl, v),
                    },
              )
            }
            onLlmBaseUrlChange={(v) => setDraft((prev) => ({ ...prev, baseUrl: v }))}
            onLlmModelChange={(v) => setDraft((prev) => ({ ...prev, model: v }))}
            onLlmApiKeyChange={(v) => setDraft((prev) => ({ ...prev, apiKey: v }))}
            onOpenaiJsonModeChange={(v) => setDraft((prev) => ({ ...prev, jsonMode: v }))}
            onOllamaThinkingEnabledChange={(v) =>
              setDraft((prev) => ({ ...prev, thinkingEnabled: v }))
            }
          />
        </FormDialogSection>

        <FormDialogSection
          title={t("profiles.sectionStaff")}
          note={t("profiles.staffClassesHelp")}
        >
          <div
            className="grid grid-cols-1 gap-sm sm:grid-cols-2"
            data-testid="llm-profile-staff-classes"
          >
            {LLM_TASK_STAFF_CLASSES.map((staffClass) => (
              <CheckboxField
                key={staffClass}
                id={`llm-profile-staff-${staffClass}`}
                label={t(`profiles.staffClass.${staffClass}`)}
                checked={draft.staffClasses.includes(staffClass)}
                onChange={(e) => toggleStaffClass(staffClass, e.target.checked)}
              />
            ))}
          </div>
        </FormDialogSection>

        <FormDialogSection title={t("webSearch.sectionTitle")} note={t("webSearch.sectionHelp")}>
          <AssistantWebSearchPanel
            enabled={draft.webSearchEnabled}
            provider={draft.webSearchProvider}
            apiKeys={keyedWebSearchApiKeysFromFields(draft)}
            llmProvider={draft.provider}
            llmBaseUrl={draft.baseUrl}
            onEnabledChange={(value) => setDraft((prev) => ({ ...prev, webSearchEnabled: value }))}
            onProviderChange={(value) =>
              setDraft((prev) => ({ ...prev, webSearchProvider: value }))
            }
            onApiKeyChange={(vendor, value) =>
              setDraft((prev) => ({ ...prev, [keyedWebSearchApiKeyField(vendor)]: value }))
            }
          />
        </FormDialogSection>

        <p className={`mb-0 ${formHelpClass}`}>{t("profiles.editorHint")}</p>
      </FormStack>
    </ModalDialog>
  );
}

export function validateProfileDraft(
  draft: LlmProfileDraft,
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (!draft.name.trim()) {
    return t("profiles.nameRequired");
  }
  // Provider config uses fully-qualified "settings:llm.*" keys, so the global
  // i18n binding resolves identically to the caller's namespaced `t`.
  const meta = getLlmProviderConfig()[draft.provider];
  if (!draft.baseUrl.trim()) {
    return meta.emptyBaseUrlMessage;
  }
  if (!draft.model.trim()) {
    return meta.emptyModelMessage;
  }
  if (
    draft.provider !== "ollama" &&
    !draft.apiKey.trim() &&
    !isMaskedSecret(draft.apiKey)
  ) {
    return t("profiles.apiKeyRequired");
  }
  return null;
}
