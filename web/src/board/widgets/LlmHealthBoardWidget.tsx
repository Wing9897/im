import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listLlmProfiles, type LlmProfile } from "../../api/llmProfiles";
import { isLlmProfileComplete } from "../../domain/settings/llmProfileCompleteness";
import { Badge } from "../../components/ui";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

type LlmHealthSummary = {
  total: number;
  complete: number;
  incomplete: number;
  sampleName: string | null;
};

function summarizeProfiles(profiles: LlmProfile[]): LlmHealthSummary {
  let complete = 0;
  let incomplete = 0;
  let sampleName: string | null = null;
  for (const profile of profiles) {
    if (isLlmProfileComplete(profile)) {
      complete += 1;
      if (sampleName == null) sampleName = profile.name;
    } else {
      incomplete += 1;
    }
  }
  return {
    total: profiles.length,
    complete,
    incomplete,
    sampleName,
  };
}

/** AI profile health: count and completeness (slots bind profiles separately). */
export function LlmHealthBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(
    () => listLlmProfiles().then(summarizeProfiles),
    [],
  );
  const { data, error, loading, refresh } = useBoardWidgetPoll<LlmHealthSummary>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  const alert = data != null && (data.total === 0 || data.incomplete > 0 || data.complete === 0);

  return (
    <div className="board-widget-body board-widget-llm-health" data-testid="board-llm-health-widget">
      <BoardWidgetShell
        loading={loading && !data}
        error={!data ? error : null}
        onRetry={refresh}
      >
        {data ? (
          <>
            <div className="board-queue-stats" data-testid="board-llm-health-stats">
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board:llmHealth.total")}</span>
                <span className="board-queue-stat__value">{data.total}</span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board:llmHealth.complete")}</span>
                <span className="board-queue-stat__value">{data.complete}</span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board:llmHealth.incomplete")}</span>
                <span
                  className={
                    data.incomplete > 0
                      ? "board-queue-stat__value board-queue-stat__value--warning"
                      : "board-queue-stat__value"
                  }
                >
                  {data.incomplete}
                </span>
              </div>
            </div>
            <div className="board-system-grid" data-testid="board-llm-health-default">
              <div className="board-system-tile">
                <span className="board-system-tile__label">{t("board:llmHealth.default")}</span>
                <Badge tone={data.complete > 0 ? "success" : "warning"}>
                  {data.complete > 0
                    ? data.sampleName || t("board:common.unnamed")
                    : t("board:llmHealth.noDefault")}
                </Badge>
              </div>
            </div>
            {alert ? (
              <p
                className="board-widget-list__error"
                data-testid="board-llm-health-alert"
              >
                {data.total === 0
                  ? t("board:llmHealth.alertNone")
                  : data.complete === 0
                    ? t("board:llmHealth.alertNoDefault")
                    : t("board:llmHealth.alertIncomplete")}
              </p>
            ) : null}
          </>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
