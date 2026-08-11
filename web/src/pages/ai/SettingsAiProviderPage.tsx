import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { testAiEngine } from "../../api/system";
import {
  copyLlmProfile,
  createLlmProfile,
  deleteLlmProfile,
  listLlmProfiles,
  patchLlmProfile,
  setDefaultLlmProfile,
  type LlmProfile,
} from "../../api/llmProfiles";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import {
  draftToUpsertBody,
  emptyProfileDraft,
  LlmProfileEditorDialog,
  profileToDraft,
  validateProfileDraft,
  type LlmProfileDraft,
} from "../../components/settings/LlmProfileEditorDialog";
import {
  SettingsContentCard,
} from "../../components/settings/SettingsFormLayout";
import { Badge, Button, FormActions, SurfaceCard } from "../../components/ui";
import {
  cardBodyClass,
  cardMetaClass,
  cardTitleClass,
  captionClass,
  formHelpClass,
} from "../../components/ui/pageTypography";
import { useToast } from "../../context/ToastContext";
import { useCollectorStatus } from "../../context/CollectorStatusContext";
import {
  getLlmProviderConfig,
  normalizeLlmProvider,
} from "../../domain/settings/llmProviderConfig";
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | "new" | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listLlmProfiles();
      setProfiles(rows);
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

  if (loading && profiles.length === 0) {
    return <LoadingSpinner text={t("profiles.loading")} />;
  }

  if (loadError && profiles.length === 0) {
    return <LoadingSpinner text={loadError} />;
  }

  return (
    <SettingsContentCard>
      <div className="flex flex-col gap-md">
        <div className="flex flex-wrap items-start justify-between gap-sm">
          <p className={`mb-0 max-w-3xl ${formHelpClass}`}>{t("profiles.intro")}</p>
          <Button type="button" variant="primary" size="sm" onClick={openCreate}>
            <Plus size={14} aria-hidden />
            {t("profiles.create")}
          </Button>
        </div>

        {profiles.length === 0 ? (
          <div className="flex flex-col items-start gap-sm" data-testid="llm-profiles-empty">
            <p className={`mb-0 ${cardBodyClass}`}>{t("profiles.empty")}</p>
            <Button type="button" variant="primary" size="sm" onClick={openCreate}>
              <Plus size={14} aria-hidden />
              {t("profiles.create")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-sm">
            {profiles.map((profile) => {
              const provider = normalizeLlmProvider(String(profile.provider));
              const providerLabel = providerLabels[provider]?.label ?? profile.provider;
              return (
                <SurfaceCard
                  key={profile.id}
                  material="solid"
                  density="compact"
                  className="flex flex-col gap-sm"
                  data-testid={`llm-profile-card-${profile.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-xs">
                        <h3 className={`m-0 ${cardTitleClass}`}>{profile.name}</h3>
                        {profile.isDefault ? (
                          <Badge tone="info">{t("profiles.defaultBadge")}</Badge>
                        ) : null}
                        <Badge tone="neutral">{providerLabel}</Badge>
                      </div>
                      <p className={`mt-xs mb-0 ${cardBodyClass}`}>
                        {profile.model || t("profiles.noModel")}
                        {profile.baseUrl ? (
                          <span className={` block ${captionClass}`}>{profile.baseUrl}</span>
                        ) : null}
                      </p>
                      {profile.staffClasses.length > 0 ? (
                        <div className={`mt-xs flex flex-wrap gap-xs ${cardMetaClass}`}>
                          {profile.staffClasses.map((staffClass) => (
                            <Badge key={staffClass} tone="neutral">
                              {t(`profiles.staffClass.${staffClass}`, {
                                defaultValue: staffClass,
                              })}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className={`mt-xs mb-0 ${cardMetaClass}`}>
                          {t("profiles.noStaffClasses")}
                        </p>
                      )}
                    </div>

                    <FormActions inline>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleTest(profileToDraft(profile), profile.id)}
                        disabled={testingId === profile.id}
                        aria-label={t("provider.testButton")}
                      >
                        {testingId === profile.id
                          ? t("provider.testing")
                          : t("provider.testButton")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(profile)}
                        aria-label={t("profiles.edit")}
                      >
                        <Pencil size={14} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleCopy(profile)}
                        aria-label={t("profiles.copy")}
                      >
                        <Copy size={14} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleSetDefault(profile)}
                        disabled={profile.isDefault}
                        aria-label={t("profiles.setDefault")}
                      >
                        <Star size={14} aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(profile)}
                        disabled={profile.isDefault}
                        aria-label={t("profiles.delete")}
                      >
                        <Trash2 size={14} aria-hidden />
                      </Button>
                    </FormActions>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </div>

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
