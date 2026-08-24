import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { UserEvent } from "../../../api/userEvents";
import { useToast } from "../../../context/ToastContext";
import type { AgentTickLogEntry } from "../../../types/analysis";
import type { RecurringSeries } from "../../../types/recurring";
import { handleCommandError } from "../../../utils/errors";
import { retractLastAgentWave } from "./retractLastAgentWave";

type Args = {
  taskId: string;
  ticks: readonly AgentTickLogEntry[] | null | undefined;
  events: UserEvent[];
  children: RecurringSeries[];
  reload: () => Promise<unknown>;
};

export function useAgentDetailRetract({ taskId, ticks, events, children, reload }: Args) {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const requestRetract = () => setConfirmOpen(true);

  const cancelRetract = () => {
    if (!busy) setConfirmOpen(false);
  };

  const confirmRetract = () => {
    void (async () => {
      setBusy(true);
      try {
        const result = await retractLastAgentWave({
          taskId,
          ticks,
          events,
          children,
        });
        if (result.status === "no_batch") {
          showToast(t("tasks:agentDetail.retractNoBatch"), "warning");
        } else if (result.status === "none") {
          showToast(t("tasks:agentDetail.retractNone"), "warning");
        } else {
          showToast(
            t("tasks:agentDetail.retractDone", { count: result.count }),
            "success",
          );
          await reload();
        }
        setConfirmOpen(false);
      } catch (error) {
        showToast(
          handleCommandError(error) || t("tasks:agentDetail.retractFailed"),
          "error",
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return { confirmOpen, busy, requestRetract, cancelRetract, confirmRetract };
}
