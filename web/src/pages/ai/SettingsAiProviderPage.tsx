import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { testAiEngine } from "../../api/system";
import {
  bindLlmGlobalSlot,
  copyLlmProfile,
  createLlmProfile,
  deleteLlmProfile,
  listLlmGlobalSlots,
  listLlmProfiles,
  patchLlmProfile,
  setDefaultLlmProfile,
  type LlmGlobalSlotBinding,
  type LlmProfile,
} from "../../api/llmProfiles";
import { ErrorRetryBanner } from "../../components/common/ErrorRetryBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { LlmGlobalSlotsPanel } from "../../components/settings/LlmGlobalSlotsPanel";
import {
  draftToUpsertBody,
  emptyProfileDraft,
  LlmProfileEditorDialog,
  profileToDraft,
  validateProfileDraft,
  type LlmProfileDraft,
} from "../../components/settings/LlmProfileEditorDialog";
import { LlmTaskProfilesSection } from "../../components/settings/LlmTaskProfilesSection";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";
import { useToast } from "../../context/ToastContext";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import {
  getLlmProviderConfig,
} from "../../domain/settings/llmProviderConfig";
import type { LlmGlobalSlotId } from "../../types/llmProfiles";
import { toErrorMessage } from "../../utils/errors";

type EditorState =
  | { mode: "create"; draft: LlmProfileDraft }
  | { mode: "edit"; profileId: string; draft: LlmProfileDraft }
  | null;

export function SettingsAiProviderPage() {
  const { t } = useTranslation("settings");
  const { showToast } = useToast();
  const { requestAiStatusRefresh } = useCollectorStatus();

  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [slots, setSlots] = useState<LlmGlobalSlotBinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingSlot, setSavingSlot] = useState<LlmGlobalSlotId | null>(null);
  const [testingId, setTestingId] = useState<string | "new" | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, slotRows] = await Promise.all([
        listLlmProfiles(),
        listLlmGlobalSlots(),
      ]);
      setProfiles(rows);
      setSlots(slotRows);
      setLoadError(null);
    } catch (error) {
      setLoadError(toErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const providerLabels = useMemo(() => getLlmProviderConfig(t), [t]);

  const openCreate = () => {
    setEditor({ mode: "create", draft: emptyProfileDraft(profiles.length === 0) });
  };

  const openEdit = (profile: LlmProfile) => {
    setEditor({
      mode: "edit",
      profileId: profile.id,
      draft: profileToDraft(profile),
    });
  };

  const handleSaveEditor = async (draft: LlmProfileDraft) => {
    const validationError = validateProfileDraft(draft, t);
    if (validationError) {
      showToast(validationError, "error");
      return;
    }
    setSaving(true);
    try {
      const body = draftToUpsertBody(draft);
      if (editor?.mode === "edit") {
        await patchLlmProfile(editor.profileId, body);
        showToast(t("profiles.updated"), "success");
      } else {
        await createLlmProfile(body);
        showToast(t("profiles.created"), "success");
      }
      setEditor(null);
      await reload();
      requestAiStatusRefresh(true);
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleBindSlot = async (slot: LlmGlobalSlotId, profileId: string | null) => {
    setSavingSlot(slot);
    try {
      const next = await bindLlmGlobalSlot(slot, profileId);
      setSlots((prev) => prev.map((row) => (row.slot === slot ? next : row)));
      showToast(t("globalSlots.boundSuccess"), "success");
      // Assistant slot syncs staff instances — refresh profile badges.
      if (slot === "assistant") {
        await reload();
      }
      requestAiStatusRefresh(true);
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    } finally {
      setSavingSlot(null);
    }
  };

  const handleCopy = async (profile: LlmProfile) => {
    try {
      await copyLlmProfile(profile.id);
      showToast(t("profiles.copied"), "success");
      await reload();
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const handleSetDefault = async (profile: LlmProfile) => {
    if (profile.isDefault) return;
    try {
      await setDefaultLlmProfile(profile.id);
      showToast(t("profiles.setDefaultSuccess"), "success");
      await reload();
      requestAiStatusRefresh(true);
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const handleDelete = async (profile: LlmProfile) => {
    // Last profile may be deleted (empty table = no default). Otherwise reassign default first.
    if (profile.isDefault && profiles.length > 1) {
      showToast(t("profiles.cannotDeleteDefault"), "error");
      return;
    }
    const ok = window.confirm(t("profiles.deleteConfirm", { name: profile.name }));
    if (!ok) return;
    try {
      await deleteLlmProfile(profile.id);
      showToast(t("profiles.deleted"), "success");
      await reload();
      requestAiStatusRefresh(true);
    } catch (error) {
      showToast(toErrorMessage(error), "error");
    }
  };

  const handleTest = async (draft: LlmProfileDraft, profileId?: string) => {
    const meta = providerLabels[draft.provider];
    if (!draft.baseUrl.trim()) {
      showToast(meta.emptyBaseUrlMessage, "error");
      return;
    }
    if (!draft.model.trim()) {
      showToast(meta.emptyModelMessage, "error");
      return;
    }
    setTestingId(profileId ?? "new");
    showToast(t("provider.testingToast"), "info");
    try {
      const result = await testAiEngine({
        llmProvider: draft.provider,
        llmBaseUrl: draft.baseUrl,
        llmModel: draft.model,
        llmApiKey: draft.apiKey,
        ollamaThinkingEnabled: draft.thinkingEnabled,
        llmProfileId: profileId,
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
      setTestingId(null);
    }
  };

  if (loading && profiles.length === 0 && slots.length === 0 && !loadError) {
    return <LoadingSpinner text={t("profiles.loading")} />;
  }

  if (loadError && profiles.length === 0 && slots.length === 0) {
    return (
      <ErrorRetryBanner
        error={loadError}
        retrying={loading}
        onRetry={() => void reload()}
      />
    );
  }

  return (
    <SettingsContentCard>
      <LlmGlobalSlotsPanel
        slots={slots}
        profiles={profiles}
        savingSlot={savingSlot}
        onBind={(slot, profileId) => void handleBindSlot(slot, profileId)}
      />

      <SettingsFieldGroup showDivider>
        <LlmTaskProfilesSection
          profiles={profiles}
          providerLabels={providerLabels}
          testingId={testingId}
          onCreate={openCreate}
          onEdit={openEdit}
          onCopy={(profile) => void handleCopy(profile)}
          onSetDefault={(profile) => void handleSetDefault(profile)}
          onDelete={(profile) => void handleDelete(profile)}
          onTest={(draft, profileId) => void handleTest(draft, profileId)}
        />
      </SettingsFieldGroup>

      {editor ? (
        <LlmProfileEditorDialog
          open
          mode={editor.mode}
          initial={editor.draft}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={handleSaveEditor}
        />
      ) : null}
    </SettingsContentCard>
  );
}
