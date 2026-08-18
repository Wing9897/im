/**
 * Workset-level 通知 / 外部接口 switches. Clicking a switch must not open the card.
 * Icons match flowchart point gates (bell / plug).
 */

import { useTranslation } from "react-i18next";
import { updateWorkset } from "../api/worksets";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import { useToast } from "../context/ToastContext";
import {
  WORKSET_GATE_ICON_PROPS,
  WORKSET_GATE_ICONS,
} from "../domain/worksets/worksetGateIcons";
import { toError } from "../utils/errors";
import { ToggleSwitch } from "./ToggleSwitch";

type Props = {
  worksetId: string;
  worksetName: string;
};

function GateToggleIcon({
  kind,
  on,
}: {
  kind: "notify" | "external";
  on: boolean;
}) {
  const Icon = WORKSET_GATE_ICONS[kind];
  return (
    <Icon
      size={WORKSET_GATE_ICON_PROPS.size}
      strokeWidth={WORKSET_GATE_ICON_PROPS.strokeWidth}
      className={on ? "text-accent" : "text-text-muted"}
      aria-hidden="true"
    />
  );
}

export function WorksetPermissionToggles({ worksetId, worksetName }: Props) {
  const { t } = useTranslation("workset");
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const ws = worksets.find((row) => row.id === worksetId);
  const notifyEnabled = ws?.notifyEnabled !== false;
  const externalEnabled = ws?.externalEnabled !== false;

  const patch = (body: { notifyEnabled?: boolean; externalEnabled?: boolean }) => {
    void updateWorkset(worksetId, body)
      .then(() => refreshWorksets())
      .catch((error) => {
        showToast(toError(error).message, "error");
      });
  };

  const notifyAria = t("notifyToggleAria", { name: worksetName });
  const externalAria = t("externalToggleAria", { name: worksetName });

  return (
    <div
      className="flex flex-wrap items-center gap-sm"
      data-testid={`workset-permission-toggles-${worksetId}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ToggleSwitch
        checked={notifyEnabled}
        onChange={(notifyEnabled) => patch({ notifyEnabled })}
        label={t("notifyToggle")}
        ariaLabel={notifyAria}
        title={notifyAria}
        showLabel={false}
        icon={<GateToggleIcon kind="notify" on={notifyEnabled} />}
        data-testid={`workset-notify-toggle-${worksetId}`}
      />
      <ToggleSwitch
        checked={externalEnabled}
        onChange={(externalEnabled) => patch({ externalEnabled })}
        label={t("externalToggle")}
        ariaLabel={externalAria}
        title={externalAria}
        showLabel={false}
        icon={<GateToggleIcon kind="external" on={externalEnabled} />}
        data-testid={`workset-external-toggle-${worksetId}`}
      />
    </div>
  );
}
