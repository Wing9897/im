import { ArrowLeft, Pencil, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MODE_BADGE_TONE } from "../../../components/task/analysisModeBadgeTone";
import { TaskEmployeeAvatar } from "../../../components/task/TaskEmployeeAvatar";
import { Badge, Button } from "../../../components/ui";
import { pageTitleClass } from "../../../components/ui/pageTypography";
import type { TaskEmployeeId } from "../../../domain/tasks/taskEmployee";

type Props = {
  name: string;
  employeeId: TaskEmployeeId;
  employeeName: string;
  retractBusy: boolean;
  onBack: () => void;
  onReload: () => void;
  onTimeline: () => void;
  onRetract: () => void;
  onEdit: () => void;
};

export function AgentDetailHeader({
  name,
  employeeId,
  employeeName,
  retractBusy,
  onBack,
  onReload,
  onTimeline,
  onRetract,
  onEdit,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <header
      className="mb-md flex min-w-0 flex-wrap items-center gap-sm"
      data-testid="project-detail-toolbar"
    >
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={onBack}
        aria-label={t("tasks:editor.back")}
        title={t("tasks:editor.back")}
      >
        <ArrowLeft size={16} strokeWidth={2.25} aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-sm">
        <TaskEmployeeAvatar employeeId={employeeId} size="sm" label={employeeName} />
        <h1 className={`min-w-0 truncate ${pageTitleClass}`}>{name}</h1>
        <Badge tone={MODE_BADGE_TONE.agent} className="shrink-0 normal-case tracking-normal">
          {employeeName}
        </Badge>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-sm">
        <Button
          variant="ghost"
          size="md"
          onClick={onReload}
          aria-label={t("tasks:agentDetail.reload")}
          title={t("tasks:agentDetail.reload")}
          data-testid="project-detail-reload"
        >
          <RefreshCw size={14} aria-hidden="true" />
          {t("tasks:agentDetail.reload")}
        </Button>
        <Button variant="secondary" size="md" onClick={onTimeline}>
          {t("tasks:agentDetail.openTimeline")}
        </Button>
        <Button
          variant="secondary"
          size="md"
          data-testid="project-detail-retract"
          disabled={retractBusy}
          onClick={onRetract}
        >
          {t("tasks:agentDetail.retractLastWave")}
        </Button>
        <Button variant="primary" size="md" onClick={onEdit}>
          <Pencil size={14} aria-hidden="true" />
          {t("edit")}
        </Button>
      </div>
    </header>
  );
}
