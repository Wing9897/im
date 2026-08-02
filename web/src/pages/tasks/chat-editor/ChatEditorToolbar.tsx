import { ArrowLeft, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTasksPageCopy } from "../../../domain/tasks/taskPageCopy";
import { Button } from "../../../components/ui";
import { pageTitleClass } from "../../../components/ui/pageTypography";
import { useAccessContext } from "../../../utils/accessContext";
import { hasDeviceSession } from "../../../domain/connection/connectionStore";

interface ChatEditorToolbarProps {
  isEditMode: boolean;
  canSaveForm: boolean;
  /** Shown on the disabled save button (missing fields / schedule error). */
  saveBlockReason?: string | null;
  isSaving: boolean;
  /** When false, hide quick presets (recurring). */
  showPresets?: boolean;
  onBack: () => void;
  onSave: () => void;
  onOpenPresetDialog: () => void;
}

/**
 * Full-width editor chrome — title left, primary actions right
 * (matches other page headers; not a centered 720px column).
 */
export function ChatEditorToolbar({
  isEditMode,
  canSaveForm,
  saveBlockReason = null,
  isSaving,
  showPresets = true,
  onBack,
  onSave,
  onOpenPresetDialog,
}: ChatEditorToolbarProps) {
  const { t } = useTranslation("common");
  const copy = getTasksPageCopy(t);
  const accessContext = useAccessContext();
  const canEditTasks = accessContext === "local" || hasDeviceSession();

  return (
    <header
      className="sticky top-0 z-[100] shrink-0 border-b border-surface-border bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)] shadow-[var(--shadow-sm)] backdrop-blur-[8px]"
      data-testid="task-editor-toolbar"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-5xl items-center gap-sm px-page-x py-sm">
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onBack}
            aria-label={t("tasks.editor.back")}
            title={t("tasks.editor.back")}
          >
            <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
          </Button>
          <h1 className={`min-w-0 truncate ${pageTitleClass}`}>
            {isEditMode ? copy.editLabel : copy.createLabel}
          </h1>
        </div>

        {!canEditTasks ? null : (
          <div className="ml-auto flex shrink-0 items-center justify-end gap-sm">
            {!isEditMode && showPresets ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenPresetDialog}
                data-testid="preset-button"
              >
                <Sparkles size={14} aria-hidden="true" />
                <span>{t("tasks.editor.presets")}</span>
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              disabled={!canSaveForm || isSaving}
              onClick={onSave}
              data-testid="task-editor-save"
              title={
                !canSaveForm || isSaving
                  ? (saveBlockReason ?? t("tasks.editor.saveNeeds.generic"))
                  : undefined
              }
            >
              {isEditMode ? t("tasks.editor.updateTask") : t("tasks.editor.createTask")}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
