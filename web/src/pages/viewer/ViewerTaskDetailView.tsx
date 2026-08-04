import { useTranslation } from "react-i18next";
import { Badge, Button } from "../../components/ui";
import { DetailPresentationShell } from "../../components/detail";
import {
  detailDialogShellClass,
  sourceDetailBodyClass,
  sourceDetailFooterClass,
  sourceDetailHeaderClass,
  sourceDetailSubtitleClass,
  sourceDetailTitleClass,
} from "../../components/detail/classes";
import type { ViewerTask } from "../../types";
import type { DetailPresentationMode } from "../../hooks/useDetailPresentation";
import { formatOsDateTime } from "../../utils/time";

interface ViewerTaskDetailViewProps {
  task: ViewerTask;
  onClose: () => void;
  presentation: DetailPresentationMode;
}

export function ViewerTaskDetailView({
  task,
  onClose,
  presentation,
}: ViewerTaskDetailViewProps) {
  const { t } = useTranslation("common");
  const content = (
    <>
      <header className={sourceDetailHeaderClass}>
        <h2 className={sourceDetailTitleClass}>{task.name}</h2>
        <div className={sourceDetailSubtitleClass}>
          <Badge tone={task.isActive ? "success" : "neutral"}>
            {task.isActive ? t("viewer.active") : t("viewer.inactive")}
          </Badge>
        </div>
      </header>
      <div className={sourceDetailBodyClass}>
        <div className="text-[11px] text-text-secondary">
          <div>{t("viewer.taskId", { id: task.id })}</div>
          <div className="mt-1.5">
            {t("viewer.lastAnalysis")}
            {task.lastAnalysisAt
              ? formatOsDateTime(task.lastAnalysisAt)
              : t("viewer.neverRun")}
          </div>
          {task.scheduleRrule ? (
            <div className="mt-1.5 font-mono">
              {t("viewer.schedule", { schedule: task.scheduleRrule })}
            </div>
          ) : null}
        </div>
      </div>
      <footer className={sourceDetailFooterClass}>
        <Button variant="secondary" onClick={onClose}>
          {t("dialog.close")}
        </Button>
      </footer>
    </>
  );

  return (
    <DetailPresentationShell
      presentation={presentation === "inline" ? "inline" : "drawer"}
      onClose={onClose}
      className={detailDialogShellClass}
      aria-label={t("viewer.taskDetailAria", { name: task.name })}
    >
      {content}
    </DetailPresentationShell>
  );
}
