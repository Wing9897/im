import { Layers, Radio, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge, CardFieldIcon } from "../ui";
import { cardTitleClass } from "../ui/pageTypography";
import { MODE_BADGE_TONE } from "./analysisModeBadgeTone";
import { TaskCardEmoji } from "./TaskCardEmoji";
import type { TaskEmployeeId } from "../../domain/tasks/taskEmployee";
import type { AnalysisTask } from "../../types/tasks";

type Props = {
  task: AnalysisTask;
  emoji: string;
  employeeId: TaskEmployeeId;
  employeeName: string;
  worksetName: string | null;
  isAgentMode: boolean;
  onEmojiChange: (glyph: string) => void | Promise<void>;
};

export function TaskCardHeader({
  task,
  emoji,
  employeeId,
  employeeName,
  worksetName,
  isAgentMode,
  onEmojiChange,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <>
      <div className="flex items-start justify-between gap-sm">
        <div className="flex min-w-0 flex-1 items-center gap-sm">
          <TaskCardEmoji
            emoji={emoji}
            name={task.name}
            employeeId={employeeId}
            employeeName={employeeName}
            onSelect={onEmojiChange}
          />
          <span className={`min-w-0 flex-1 truncate ${cardTitleClass}`} title={task.name}>
            {task.name}
          </span>
        </div>
        <Badge tone={MODE_BADGE_TONE[task.analysisMode]}>{employeeName}</Badge>
      </div>

      <div className="text-[11px] text-text-muted">
        {worksetName ? (
          <span className="mb-0.5 flex min-w-0 items-center gap-xs truncate" title={worksetName}>
            <CardFieldIcon icon={Layers} />
            {t("workset:cardLabel", { name: worksetName })}
          </span>
        ) : null}
        <span className="flex min-w-0 items-center gap-xs">
          <CardFieldIcon icon={isAgentMode ? Sparkles : Radio} />
          {isAgentMode
            ? t("tasks:card.agent")
            : t("tasks:card.channelsRange", {
                count: (task.channelIds ?? []).length,
                range: task.analysisTimeRange,
              })}
        </span>
      </div>
    </>
  );
}
