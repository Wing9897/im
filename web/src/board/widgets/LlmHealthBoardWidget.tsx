import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  listLlmGlobalSlots,
  listLlmProfiles,
  type LlmGlobalSlotBinding,
  type LlmProfile,
} from "../../api/llmProfiles";
import { isLlmProfileComplete } from "../../domain/settings/llmProfileCompleteness";
import { LLM_GLOBAL_SLOTS, type LlmGlobalSlotId } from "../../types/llmProfiles";
import { Badge } from "../../components/ui";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

type LlmHealthSummary = {
  total: number;
  complete: number;
  incomplete: number;
  slots: LlmGlobalSlotBinding[];
  profilesById: Map<string, LlmProfile>;
};

function summarizeLlmHealth(
  profiles: LlmProfile[],
  slots: LlmGlobalSlotBinding[],
): LlmHealthSummary {
  let complete = 0;
  let incomplete = 0;
  for (const profile of profiles) {
    if (isLlmProfileComplete(profile)) {
      complete += 1;
    } else {
      incomplete += 1;
    }
  }
  return {
    total: profiles.length,
    complete,
    incomplete,
    slots,
    profilesById: new Map(profiles.map((profile) => [profile.id, profile])),
  };
}

function slotBindingLabel(
  slot: LlmGlobalSlotBinding,
  profilesById: Map<string, LlmProfile>,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const profileId = (slot.profileId ?? "").trim();
  if (!profileId) return t("settings:globalSlots.unbound");
  const profile = profilesById.get(profileId);
  if (!profile) return slot.profileName || t("board:common.unnamed");
  if (!isLlmProfileComplete(profile)) {
    return `${profile.name} — ${t("settings:globalSlots.incompleteBadge")}`;
  }
  return profile.name;
}

/** AI profile health + global slot bindings (read-only summary). */
export function LlmHealthBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation(["board", "settings"]);
  const fetcher = useCallback(
    () =>
      Promise.all([listLlmProfiles(), listLlmGlobalSlots()]).then(([profiles, slots]) =>
        summarizeLlmHealth(profiles, slots),
      ),
    [],
  );
  const { data, error, loading, refresh } = useBoardWidgetPoll<LlmHealthSummary>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  const slotsById = new Map<LlmGlobalSlotId, LlmGlobalSlotBinding>(
    (data?.slots ?? []).map((row) => [row.slot, row]),
  );

  const alert =
    data != null && (data.total === 0 || data.incomplete > 0 || data.complete === 0);

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
            <ul
              className="board-widget-list board-llm-slots-list"
              data-testid="board-llm-health-slots"
            >
              {LLM_GLOBAL_SLOTS.map((slotId) => {
                const binding = slotsById.get(slotId);
                const profileId = (binding?.profileId ?? "").trim();
                const profile = profileId ? data.profilesById.get(profileId) : undefined;
                const boundReady = Boolean(profile && isLlmProfileComplete(profile));
                const label = binding
                  ? slotBindingLabel(binding, data.profilesById, t)
                  : t("settings:globalSlots.unbound");
                return (
                  <li key={slotId} className="board-widget-list__item">
                    <div
                      className="board-widget-list__row"
                      data-testid={`board-llm-slot-${slotId}`}
                    >
                      <span className="board-widget-list__primary">
                        {t(`settings:globalSlots.slot.${slotId}.title`)}
                        <Badge tone={boundReady ? "info" : "neutral"}>
                          {boundReady
                            ? t("settings:globalSlots.boundBadge")
                            : t("settings:globalSlots.needsSetupBadge")}
                        </Badge>
                      </span>
                      <span className="board-widget-list__meta">{label}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
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
