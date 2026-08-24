import type { CSSProperties } from "react";
import { Pencil, PowerOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ToggleSwitch } from "../ToggleSwitch";
import { stopSelectableActivation } from "../detail/SelectableSurface";

const actionIconBtnClass =
  "im-icon-btn !h-7 !w-7 !rounded-md text-text-secondary transition-colors";

type Props = {
  taskName: string;
  taskId: string;
  isActive: boolean;
  isAnalyzing: boolean;
  toggling: boolean;
  runningDotStyle: CSSProperties;
  toggleLabel: string;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function TaskCardActions({
  taskName,
  taskId,
  isActive,
  isAnalyzing,
  toggling,
  runningDotStyle,
  toggleLabel,
  onToggle,
  onEdit,
  onDelete,
}: Props) {
  const { t } = useTranslation("common");

  return (
    <div
      className="mt-auto flex flex-nowrap items-center justify-between gap-sm pt-xs"
      onClick={stopSelectableActivation}
      onKeyDown={stopSelectableActivation}
    >
      <div className="inline-flex min-w-0 flex-nowrap items-center gap-1.5 text-[11px] leading-none text-text-muted">
        {!isActive ? (
          <span
            className="inline-flex shrink-0 text-text-muted"
            title={t("tasks:card.disabled")}
            aria-label={t("tasks:card.disabled")}
            data-testid={`task-card-inactive-icon-${taskId}`}
          >
            <PowerOff size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        ) : (
          <span
            style={runningDotStyle}
            className={isAnalyzing ? "im-pulse-dot" : undefined}
            aria-hidden="true"
          />
        )}
        <span
          className={["truncate", isActive && isAnalyzing ? "text-info" : undefined]
            .filter(Boolean)
            .join(" ")}
        >
          {isActive
            ? isAnalyzing
              ? t("tasks:card.running")
              : t("tasks:card.idle")
            : t("tasks:card.disabled")}
        </span>
      </div>

      <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
        <ToggleSwitch
          checked={isActive}
          onChange={onToggle}
          disabled={toggling}
          showLabel={false}
          label={toggleLabel}
        />
        <button
          type="button"
          className={actionIconBtnClass}
          onClick={onEdit}
          aria-label={t("tasks:card.editAria", { name: taskName })}
          title={t("tasks:card.edit")}
        >
          <Pencil size={14} strokeWidth={2} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={actionIconBtnClass}
          onClick={onDelete}
          aria-label={t("tasks:card.deleteAria", { name: taskName })}
          title={t("tasks:card.delete")}
        >
          <Trash2 size={14} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
