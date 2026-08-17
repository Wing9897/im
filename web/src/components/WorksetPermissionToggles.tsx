/**
 * Workset-level 通知 / 外部接口 switches. Clicking a switch must not open the card.
 */

import { useTranslation } from "react-i18next";
import { updateWorkset } from "../api/worksets";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import { useToast } from "../context/ToastContext";
import { toError } from "../utils/errors";
import { SwitchTrack } from "./ui";
import { captionClass } from "./ui/pageTypography";

type Props = {
  worksetId: string;
  worksetName: string;
};

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

  return (
    <div
      className="flex flex-wrap items-center gap-md"
      data-testid={`workset-permission-toggles-${worksetId}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        role="switch"
        aria-checked={notifyEnabled}
        aria-label={t("notifyToggleAria", { name: worksetName })}
        data-testid={`workset-notify-toggle-${worksetId}`}
        className="inline-flex cursor-pointer items-center gap-xs border-0 bg-transparent p-0 shadow-none"
        onClick={() => patch({ notifyEnabled: !notifyEnabled })}
      >
        <SwitchTrack checked={notifyEnabled} size="sm" />
        <span className={`select-none ${captionClass}`}>{t("notifyToggle")}</span>
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={externalEnabled}
        aria-label={t("externalToggleAria", { name: worksetName })}
        data-testid={`workset-external-toggle-${worksetId}`}
        className="inline-flex cursor-pointer items-center gap-xs border-0 bg-transparent p-0 shadow-none"
        onClick={() => patch({ externalEnabled: !externalEnabled })}
      >
        <SwitchTrack checked={externalEnabled} size="sm" />
        <span className={`select-none ${captionClass}`}>{t("externalToggle")}</span>
      </button>
    </div>
  );
}
