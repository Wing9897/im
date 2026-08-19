import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SettingsRow,
  MenuSelect,
  TextField,
  Button,
  SelectTile,
  SelectTileGrid,
  Badge,
  FieldLabel,
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
import { TaskAvatarStack } from "../../../components/task/TaskAvatarStack";
import { TaskCardEmoji } from "../../../components/task/TaskCardEmoji";
import { useTaskEmoji } from "../useTaskEmojis";
import { analysisModeForTaskEmployee } from "../../../domain/tasks/taskEmployee";
import { WorksetNameDialog } from "../../../components/dialogs/WorksetNameDialog";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { createWorkset } from "../../../api/worksets";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { useToast } from "../../../context/ToastContext";
import { toError } from "../../../utils/errors";
import { useChatEditorLlmProfiles, type LlmProfileGate } from "./useChatEditorLlmProfiles";

interface ChatNameModeFieldsProps {
  name: string;
  analysisMode: AnalysisMode;
  worksetId: string;
  llmProfileId: string;
  onNameChange: (value: string) => void;
  onAnalysisModeChange: (value: AnalysisMode) => void;
  onWorksetIdChange: (value: string) => void;
  onLlmProfileIdChange: (value: string) => void;
  onLlmProfileGateChange?: (gate: LlmProfileGate) => void;
  /** Existing task id enables emoji picker; create form is display-only. */
  taskId?: string;
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
  taskId,
}: ChatNameModeFieldsProps) {
  const { t } = useTranslation("common");
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const {
    profilesLoading,
    profilesEmpty,
    profilesAllIncomplete,
    profileOptions,
    selectedProfile,
    selectedComplete,
  } = useChatEditorLlmProfiles({
    llmProfileId,
    onLlmProfileIdChange,
    onLlmProfileGateChange,
  });

  const worksetOptions = useMemo(
    () =>
      worksets.map((ws) => ({
        value: ws.id,
        label: ws.id === SYSTEM_WORKSET_ID ? t("workset:generalName") : ws.name,
      })),
    [t, worksets],
  );

  const handleCreateWorkset = async (cleaned: string) => {
    setCreateBusy(true);
    try {
      const created = await createWorkset(cleaned);
      await refreshWorksets();
      onWorksetIdChange(created.id);
      showToast(t("workset:createdToast", { name: created.name }), "success");
      setCreateOpen(false);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setCreateBusy(false);
    }
  };

  const requiredTitle = t("tasks:editor.requiredSuffix");
  const identityEmployeeId = getTaskEmployeeIdForMode(analysisMode);
  const identityEmployeeName = getTaskEmployeeDisplayName(identityEmployeeId);
  const { emoji, setEmoji, canEdit } = useTaskEmoji(taskId);

  return (
    <>
      <SettingsRow
        className="md:col-span-2"
        label={t("tasks:editor.nameLabel")}
        htmlFor="chat-task-name"
        required
        requiredTitle={requiredTitle}
      >
        <div className="flex min-w-0 items-center gap-sm">
          {canEdit ? (
            <TaskCardEmoji
              emoji={emoji}
              name={name || t("tasks:editor.nameLabel")}
              employeeId={identityEmployeeId}
              employeeName={identityEmployeeName}
              onSelect={setEmoji}
            />
          ) : (
            <TaskAvatarStack
              emoji={emoji}
              employeeId={identityEmployeeId}
              employeeName={identityEmployeeName}
            />
          )}
          <TextField
            id="chat-task-name"
            type="text"
            placeholder={t("tasks:editor.namePlaceholder")}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            required
            aria-required
            className="min-w-0 flex-1"
          />
        </div>
      </SettingsRow>

      <div
        className="flex flex-col gap-sm md:col-span-2"
        role="group"
        aria-label={t("tasks:editor.taskTypeLabel")}
        aria-required
        data-testid="task-employee-picker"
      >
        <FieldLabel required requiredTitle={requiredTitle} className="mb-0">
          {t("tasks:editor.taskTypeLabel")}
        </FieldLabel>
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
                  />
                  <span className="leading-snug">{nameLabel}</span>
                </span>
              </SelectTile>
            );
          })}
        </SelectTileGrid>
      </div>

      <SettingsRow label={t("workset:ownershipLabel")} htmlFor="chat-workset">
        <div className="flex flex-wrap items-center gap-sm">
          <MenuSelect
            id="chat-workset"
            variant="field"
            menuPortal
            value={worksetId || SYSTEM_WORKSET_ID}
            options={worksetOptions}
            onChange={(next) => onWorksetIdChange(next || SYSTEM_WORKSET_ID)}
            className="min-w-0 flex-1"
            aria-label={t("workset:ownershipLabel")}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            {t("workset:create")}
          </Button>
        </div>
      </SettingsRow>

      <div className="md:col-span-2">
        <SettingsRow
          label={t("tasks:editor.llmProfileLabel")}
          htmlFor={profilesEmpty ? undefined : "chat-llm-profile"}
          help={t("tasks:editor.llmProfileHint")}
          required
          requiredTitle={requiredTitle}
        >
          {profilesLoading ? (
            <p className={`m-0 ${formHelpClass}`} data-testid="task-llm-profile-loading">
              {t("tasks:editor.llmProfileLoading")}
            </p>
          ) : profilesEmpty ? (
            <div
              className="flex flex-col items-start gap-sm"
              data-testid="task-llm-profile-empty"
            >
              <p className={`m-0 ${formHelpClass}`}>{t("tasks:editor.llmProfileEmpty")}</p>
              <a
                href="/ai/provider"
                data-testid="task-llm-profile-create-cta"
                className={[
                  buttonBaseClass,
                  buttonSizeClass.sm,
                  "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
                ].join(" ")}
              >
                {t("tasks:editor.llmProfileCreateCta")}
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
                  placeholder={t("tasks:editor.llmProfilePlaceholder")}
                  onChange={onLlmProfileIdChange}
                  className="min-w-0 flex-1"
                  aria-label={t("tasks:editor.llmProfileLabel")}
                  aria-required
                  data-testid="task-llm-profile"
                  disabled={profilesAllIncomplete}
                />
                {selectedProfile && !selectedComplete ? (
                  <Badge tone="warning" data-testid="task-llm-profile-incomplete-badge">
                    {t("tasks:editor.llmProfileIncompleteBadge")}
                  </Badge>
                ) : null}
              </div>
              {profilesAllIncomplete ? (
                <div
                  className="flex flex-wrap items-center gap-sm"
                  data-testid="task-llm-profile-all-incomplete"
                >
                  <p className={`m-0 ${formHelpClass}`}>
                    {t("tasks:editor.llmProfileAllIncomplete")}
                  </p>
                  <a
                    href="/ai/provider"
                    className={[
                      buttonBaseClass,
                      buttonSizeClass.sm,
                      "inline-flex no-underline bg-accent border-accent text-[var(--text-on-accent)] font-medium hover:bg-[color-mix(in_srgb,var(--accent)_88%,var(--text-primary))]",
                    ].join(" ")}
                  >
                    {t("tasks:editor.llmProfileCreateCta")}
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
