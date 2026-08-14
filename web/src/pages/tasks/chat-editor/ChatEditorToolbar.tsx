import { ArrowLeft, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getTasksPageCopy } from "../../../domain/tasks/taskPageCopy";
import { Button } from "../../../components/ui";
import { useAccessContext } from "../../../utils/accessContext";
import { hasDeviceSession } from "../../../domain/connection/connectionStore";
import {
  pageChromeActionsClass,
  pageChromeBackButtonClass,
  pageChromeInnerClass,
  pageChromeOuterClass,
  pageChromeTitleClass,
  pageChromeTitleClusterClass,
} from "../../../components/ui/pageChrome";

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
 * Full-width editor chrome — shared sticky pageChrome tokens
 * (not OpsControlBar). Title left, primary actions right.
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
      className={pageChromeOuterClass}
      data-testid="task-editor-toolbar"
    >
      <div className={pageChromeInnerClass}>
        <div className={pageChromeTitleClusterClass}>
          <Button
            variant="ghost"
            size="icon"
            className={pageChromeBackButtonClass}
            onClick={onBack}
            aria-label={t("tasks:editor.back")}
            title={t("tasks:editor.back")}
          >
            <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
          </Button>
          <h1 className={pageChromeTitleClass}>
            {isEditMode ? copy.editLabel : copy.createLabel}
          </h1>
        </div>

        {!canEditTasks ? null : (
          <div className={pageChromeActionsClass}>
            {!isEditMode && showPresets ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenPresetDialog}
                data-testid="preset-button"
              >
                <Sparkles size={14} aria-hidden="true" />
                <span>{t("tasks:editor.presets")}</span>
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
                  ? (saveBlockReason ?? t("tasks:editor.saveNeeds.generic"))
                  : undefined
              }
            >
              {isEditMode ? t("tasks:editor.updateTask") : t("tasks:editor.createTask")}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
