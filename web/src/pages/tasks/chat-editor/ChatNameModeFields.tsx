import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SettingsRow,
  MenuSelect,
  TextField,
  Button,
  SelectTile,
  SelectTileGrid,
  Badge,
} from "../../../components/ui";
import { buttonBaseClass, buttonSizeClass } from "../../../components/ui/controlStyles";
import { formHelpClass } from "../../../components/ui/pageTypography";
import type { AnalysisMode } from "../../../types";
import {
  getTaskEmployeeBlurb,
  getTaskEmployeeDisplayName,
  getTaskEmployeeIdForMode,
  taskFormAnalysisModeOrder,
} from "../../../components/task/taskFormAnalysisModeMeta";
import { TaskEmployeeAvatar } from "../../../components/task/TaskEmployeeAvatar";
import { analysisModeForTaskEmployee } from "../../../domain/tasks/taskEmployee";
import { WorksetNameDialog } from "../../../components/dialogs/WorksetNameDialog";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { createWorkset } from "../../../api/worksets";
import { listLlmProfiles, type LlmProfile } from "../../../api/llmProfiles";
import {
  firstCompleteDefaultProfile,
  isLlmProfileComplete,
} from "../../../domain/settings/llmProfileCompleteness";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { useToast } from "../../../context/ToastContext";
import { toError } from "../../../utils/errors";

export type LlmProfileGate = {
  ready: boolean;
  reason: string | null;
};

interface ChatNameModeFieldsProps {
  name: string;
  analysisMode: AnalysisMode;
  worksetId: string | null;
  llmProfileId: string;
  onNameChange: (value: string) => void;
  onAnalysisModeChange: (value: AnalysisMode) => void;
  onWorksetIdChange: (value: string | null) => void;
  onLlmProfileIdChange: (value: string) => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
}

/** Name + task-type picker + workset + LLM profile as FormGrid cells. */
export function ChatNameModeFields({
  name,
  analysisMode,
  worksetId,
  llmProfileId,
  onNameChange,
  onAnalysisModeChange,
  onWorksetIdChange,
  onLlmProfileIdChange,
  onLlmProfileGateChange,
}: ChatNameModeFieldsProps) {
  const { t } = useTranslation("common");
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [profiles, setProfiles] = useState<LlmProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setProfilesLoading(true);
    listLlmProfiles()
      .then((list) => {
        if (cancelled) return;
        setProfiles(list);
      })
      .catch((error) => {
        if (cancelled) return;
        showToast(toError(error).message, "error");
        setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setProfilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  // Create path: preselect only a *complete* default (never invent a fake selection).
  useEffect(() => {
    if (llmProfileId.trim() || profilesLoading) return;
    const pick = firstCompleteDefaultProfile(profiles);
    if (pick) onLlmProfileIdChange(pick.id);
  }, [llmProfileId, profiles, profilesLoading, onLlmProfileIdChange]);

  // If the stored id points at an incomplete / missing profile, clear it on create-like empty pick.
  useEffect(() => {
    if (profilesLoading || !llmProfileId.trim()) return;
    const selected = profiles.find((p) => p.id === llmProfileId);
    if (selected && !isLlmProfileComplete(selected)) {
      // Keep id so edit mode can show the incomplete selection + block save;
      // do not auto-clear — user must pick a complete profile.
      return;
    }
    if (!selected && profiles.length > 0) {
      // Stale id after profile delete — clear so placeholder shows.
      onLlmProfileIdChange("");
    }
  }, [llmProfileId, profiles, profilesLoading, onLlmProfileIdChange]);

  const worksetOptions = useMemo(
    () => [
      { value: "", label: t("workset.unassigned") },
      ...worksets.map((ws) => ({
        value: ws.id,
        label: ws.id === SYSTEM_WORKSET_ID ? t("workset.generalName") : ws.name,
      })),
    ],
    [t, worksets],
  );

  const profileOptions = useMemo(
    () =>
      profiles.map((profile) => {
        const complete = isLlmProfileComplete(profile);
        const base = profile.isDefault
          ? `${profile.name} (${t("tasks.editor.llmProfileDefaultBadge")})`
          : profile.name;
        return {
          value: profile.id,
          label: complete
            ? base
            : `${base} — ${t("tasks.editor.llmProfileIncompleteBadge")}`,
          disabled: !complete,
        };
      }),
    [profiles, t],
  );

  const selectedProfile = profiles.find((p) => p.id === llmProfileId) ?? null;
  const selectedComplete = selectedProfile ? isLlmProfileComplete(selectedProfile) : false;
  const hasCompleteProfile = profiles.some(isLlmProfileComplete);
  const profilesEmpty = !profilesLoading && profiles.length === 0;
  const profilesAllIncomplete =
    !profilesLoading && profiles.length > 0 && !hasCompleteProfile;

  useEffect(() => {
    if (!onLlmProfileGateChange) return;
    if (profilesLoading) {
      onLlmProfileGateChange({ ready: false, reason: t("tasks.editor.saveNeeds.llmProfileLoading") });
      return;
    }
    if (profilesEmpty) {
      onLlmProfileGateChange({
        ready: false,
        reason: t("tasks.editor.saveNeeds.llmProfileEmpty"),
      });
      return;
    }
    if (!llmProfileId.trim() || !selectedProfile) {
      onLlmProfileGateChange({
        ready: false,
        reason: t("tasks.editor.saveNeeds.llmProfile"),
      });
      return;
    }
    if (!selectedComplete) {
      onLlmProfileGateChange({
        ready: false,
        reason: t("tasks.editor.saveNeeds.llmProfileIncomplete"),
      });
      return;
    }
    onLlmProfileGateChange({ ready: true, reason: null });
  }, [
    llmProfileId,
    onLlmProfileGateChange,
    profilesEmpty,
    profilesLoading,
    selectedComplete,
    selectedProfile,
    t,
  ]);

  const handleCreateWorkset = async (cleaned: string) => {
    setCreateBusy(true);
    try {
      const created = await createWorkset(cleaned);
      await refreshWorksets();
      onWorksetIdChange(created.id);
      showToast(t("workset.createdToast", { name: created.name }), "success");
      setCreateOpen(false);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-xs md:col-span-2">
        <span className="text-caption font-semibold tracking-wide text-text-secondary">
          {t("tasks.editor.foundationTitle")}
        </span>
        <p className={`m-0 ${formHelpClass}`}>{t("tasks.editor.foundationHint")}</p>
      </div>

      <SettingsRow label={t("tasks.editor.nameLabel")} htmlFor="chat-task-name">
        <TextField
          id="chat-task-name"
          type="text"
          placeholder={t("tasks.editor.namePlaceholder")}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
        />
      </SettingsRow>
      <SettingsRow label={t("workset.ownershipLabel")} htmlFor="chat-workset">
        <div className="flex flex-wrap items-center gap-sm">
          <MenuSelect
            id="chat-workset"
            variant="field"
            menuPortal
            value={worksetId ?? ""}
            options={worksetOptions}
            onChange={(next) => onWorksetIdChange(next || null)}
            className="min-w-0 flex-1"
            aria-label={t("workset.ownershipLabel")}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            {t("workset.create")}
          </Button>
        </div>
      </SettingsRow>

      <div
        className="flex flex-col gap-sm md:col-span-2"
        role="group"
        aria-label={t("tasks.editor.taskTypeLabel")}
        data-testid="task-employee-picker"
      >
        <span className="text-caption font-medium text-text-primary">
          {t("tasks.editor.taskTypeLabel")}
        </span>
        <SelectTileGrid
          columns="repeat(auto-fit, minmax(148px, 1fr))"
          className="gap-sm"
        >
          {taskFormAnalysisModeOrder.map((mode) => {
            const employeeId = getTaskEmployeeIdForMode(mode);
            const nameLabel = getTaskEmployeeDisplayName(employeeId);
            const blurb = getTaskEmployeeBlurb(employeeId);
            const selected = analysisMode === mode;
            return (
              <SelectTile
                key={mode}
                compact
                active={selected}
                aria-pressed={selected}
                onClick={() =>
                  onAnalysisModeChange(analysisModeForTaskEmployee(employeeId))
                }
                hint={blurb}
                className="min-h-0"
              >
                <span className="flex items-center gap-sm">
                  <TaskEmployeeAvatar
                    employeeId={employeeId}
                    size="sm"
                    label={nameLabel}
                    showRecurringIcon
                  />
                  <span className="leading-snug">{nameLabel}</span>
                </span>
              </SelectTile>
            );
          })}
        </SelectTileGrid>
      </div>

      <div className="md:col-span-2">
        <SettingsRow
          label={t("tasks.editor.llmProfileLabel")}
          htmlFor={profilesEmpty ? undefined : "chat-llm-profile"}
          help={t("tasks.editor.llmProfileHint")}
        >
          {profilesLoading ? (
            <p className={`m-0 ${formHelpClass}`} data-testid="task-llm-profile-loading">
              {t("tasks.editor.llmProfileLoading")}
            </p>
          ) : profilesEmpty ? (
            <div
              className="flex flex-col items-start gap-sm"
              data-testid="task-llm-profile-empty"
            >
              <p className={`m-0 ${formHelpClass}`}>{t("tasks.editor.llmProfileEmpty")}</p>
              <a
                href="/ai/provider"
                data-testid="task-llm-profile-create-cta"
                className={[
                  buttonBaseClass,
                  buttonSizeClass.sm,
                  "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
                ].join(" ")}
              >
                {t("tasks.editor.llmProfileCreateCta")}
              </a>
            </div>
          ) : (
            <div className="flex flex-col gap-sm">
              <div className="flex flex-wrap items-center gap-sm">
                <MenuSelect
                  id="chat-llm-profile"
                  variant="field"
                  menuPortal
                  value={llmProfileId}
                  options={profileOptions}
                  placeholder={t("tasks.editor.llmProfilePlaceholder")}
                  onChange={onLlmProfileIdChange}
                  className="min-w-0 flex-1"
                  aria-label={t("tasks.editor.llmProfileLabel")}
                  data-testid="task-llm-profile"
                  disabled={profilesAllIncomplete}
                />
                {selectedProfile?.isDefault && selectedComplete ? (
                  <Badge tone="accent" data-testid="task-llm-profile-default-badge">
                    {t("tasks.editor.llmProfileDefaultBadge")}
                  </Badge>
                ) : null}
                {selectedProfile && !selectedComplete ? (
                  <Badge tone="warning" data-testid="task-llm-profile-incomplete-badge">
                    {t("tasks.editor.llmProfileIncompleteBadge")}
                  </Badge>
                ) : null}
              </div>
              {profilesAllIncomplete ? (
                <div
                  className="flex flex-wrap items-center gap-sm"
                  data-testid="task-llm-profile-all-incomplete"
                >
                  <p className={`m-0 ${formHelpClass}`}>
                    {t("tasks.editor.llmProfileAllIncomplete")}
                  </p>
                  <a
                    href="/ai/provider"
                    className={[
                      buttonBaseClass,
                      buttonSizeClass.sm,
                      "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
                    ].join(" ")}
                  >
                    {t("tasks.editor.llmProfileCreateCta")}
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </SettingsRow>
      </div>

      <WorksetNameDialog
        open={createOpen}
        mode="create"
        busy={createBusy}
        onClose={() => {
          if (!createBusy) setCreateOpen(false);
        }}
        onSubmit={handleCreateWorkset}
      />
    </>
  );
}
