import { useTranslation } from "react-i18next";
import { Clock, Zap } from "lucide-react";
import { AccentBarCard, Badge, Button, CardFieldRow } from "../../../components/ui";
import { cardTitleClass } from "../../../components/ui/pageTypography";
import type { Action, ActionType } from "../../../types";
import {
  ACTION_TYPE_LABELS,
  formatTriggerSummary,
} from "../../../domain/actions/actionLabels";
import { formatOptionalOsDateTime } from "../../../utils/time";
import { PlatformIcon } from "../../../components/common/PlatformIcon";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { SelectableSurface, stopSelectableActivation } from "../../../components/detail";

const actionTypePlatforms: Record<ActionType, string> = {
  telegram_bot: "telegram",
  discord_webhook: "discord",
  http_webhook: "api",
  mqtt: "mqtt",
};


export function ActionCard({
  action,
  onToggle,
  onEdit,
  onDelete,
  onTest,
  onSelect,
  isSelected = false,
}: {
  action: Action;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (action: Action) => void;
  onDelete: (action: Action) => void;
  onTest: (action: Action) => void;
  onSelect?: () => void;
  isSelected?: boolean;
}) {
  const { t } = useTranslation("actions");
  const platform = actionTypePlatforms[action.actionType] ?? "api";

  return (
    <SelectableSurface
      variant="none"
      onSelect={onSelect}
      selectAriaLabel={onSelect ? t("card.viewDetailAria", { name: action.name }) : undefined}
      className="h-full min-w-0 overflow-hidden"
    >
      <AccentBarCard
        accentClass={action.isEnabled ? "bg-success" : "bg-text-muted"}
        interactive
        className={
          isSelected
            ? "ring-1 ring-accent ring-offset-1 ring-offset-[var(--surface-base)]"
            : undefined
        }
      >
        <div className="flex items-center gap-sm">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--surface-overlay)_40%,transparent)]">
            <PlatformIcon platform={platform} size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate ${cardTitleClass}`}>{action.name}</div>
            <div className="mt-0.5 flex min-w-0 flex-col gap-0.5">
              <CardFieldRow
                icon={Zap}
                text={`${ACTION_TYPE_LABELS[action.actionType] ?? action.actionType} · ${t("card.triggeredPrefix")}${formatTriggerSummary(action, (key, options) =>
                  key === "specificTask"
                    ? t("card.specificTaskWithId", options)
                    : t(`card.${key}`, options),
                )}`}
                className="text-[10px] leading-snug text-text-muted"
              />
              <CardFieldRow
                icon={Clock}
                text={`${t("card.lastTriggeredPrefix")}${formatOptionalOsDateTime(action.lastTriggeredAt, undefined, t("card.never"))}`}
                empty={!action.lastTriggeredAt}
                className="text-[10px] leading-snug text-text-muted"
              />
            </div>
          </div>
          <Badge tone={action.isEnabled ? "success" : "neutral"}>
            {action.isEnabled ? t("card.enabled") : t("card.disabled")}
          </Badge>
          <div
            className="flex shrink-0 items-center gap-1"
            onClick={stopSelectableActivation}
            onKeyDown={stopSelectableActivation}
          >
            <ToggleSwitch
              checked={action.isEnabled}
              onChange={(val) => onToggle(action.id, val)}
              showLabel={false}
              label={t("card.toggleAria", {
                action: action.isEnabled ? t("card.disableAction") : t("card.enableAction"),
                name: action.name,
              })}
            />

            <Button size="sm" variant="secondary" onClick={() => onTest(action)}>
              {t("card.test")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onEdit(action)}>
              {t("card.edit")}
            </Button>
            <Button size="sm" variant="danger" onClick={() => onDelete(action)}>
              {t("card.delete")}
            </Button>
          </div>
        </div>
      </AccentBarCard>
    </SelectableSurface>
  );
}
