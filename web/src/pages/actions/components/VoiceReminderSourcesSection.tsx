/**
 * Voice reminder source filter — hierarchical workset/task tree via SourceFilterDialog.
 */

import { useTranslation } from "react-i18next";
import { SourceFilterDialog } from "../../../components/SourceFilterDialog";
import {
  PanelSection,
  formHelpClass,
} from "../../../components/ui";
import type { SourceFilterSelection } from "../../../domain/tasks/sourceFilterSelection";
import { sourceFilterSelectedCount } from "../../../domain/tasks/sourceFilterSelection";
import type { SourceFilterOption } from "../../../domain/timeline/sourceFilterOptions";

export function VoiceReminderSourcesSection({
  tasksLoading,
  filterTasks,
  worksets,
  expandTasks,
  selection,
  onChange,
}: {
  tasksLoading: boolean;
  filterTasks: SourceFilterOption[];
  worksets: Array<{ id: string; name: string; isSystem?: boolean }>;
  expandTasks: Array<{
    id: string;
    name?: string;
    worksetId?: string | null;
    analysisMode?: string | null;
  }>;
  selection: SourceFilterSelection;
  onChange: (next: SourceFilterSelection) => void;
}) {
  const { t } = useTranslation("actions");
  const listenAll = selection === null;
  const selectedCount = listenAll ? 0 : sourceFilterSelectedCount(selection);

  return (
    <PanelSection title={t("voice.sectionSources")} showCount={false}>
      {tasksLoading ? (
        <p className={formHelpClass}>{t("voice.loadingTasks")}</p>
      ) : (
        <div className="flex flex-col gap-md">
          <div className="flex flex-wrap items-center justify-between gap-sm">
            <p className="m-0 text-body text-text-secondary">
              {listenAll ? (
                <>
                  {t("voice.previewListenAll")}
                  <span className="font-medium text-text-primary">
                    {t("voice.previewAllSources")}
                  </span>
                  {t("voice.previewTimedEvents")}
                </>
              ) : (
                <>
                  {t("voice.previewSelectedPrefix")}
                  <span className="font-medium text-accent">{selectedCount}</span>
                  {t("voice.previewSelectedSuffix")}
                </>
              )}
            </p>
            <SourceFilterDialog
              tasks={filterTasks}
              worksets={worksets}
              expandTasks={expandTasks}
              selection={selection}
              onChange={onChange}
              ariaLabelPrefix={t("voice.sectionSources")}
              variant="toolbar"
            />
          </div>
          <p className={formHelpClass}>{t("voice.sourcesHelp")}</p>
        </div>
      )}
    </PanelSection>
  );
}
