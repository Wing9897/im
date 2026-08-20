import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, MenuSelect, SettingsRow } from "../../../components/ui";
import { WorksetNameDialog } from "../../../components/dialogs/WorksetNameDialog";
import { useTaskCatalog } from "../../../context/TaskCatalogContext";
import { createWorkset } from "../../../api/worksets";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import { useToast } from "../../../context/ToastContext";
import { toError } from "../../../utils/errors";

interface ChatWorksetFieldProps {
  worksetId: string;
  onWorksetIdChange: (value: string) => void;
}

export function ChatWorksetField({ worksetId, onWorksetIdChange }: ChatWorksetFieldProps) {
  const { t } = useTranslation("common");
  const { worksets, refreshWorksets } = useTaskCatalog();
  const { showToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  const worksetOptions = useMemo(
    () =>
      worksets.map((ws) => ({
        value: ws.id,
        label: ws.id === SYSTEM_WORKSET_ID ? t("workset:generalName") : ws.name,
      })),
    [t, worksets],
  );

  const handleCreateWorkset = async (cleaned: string) => {
    setCreateBusy(true);
    try {
      const created = await createWorkset(cleaned);
      await refreshWorksets();
      onWorksetIdChange(created.id);
      showToast(t("workset:createdToast", { name: created.name }), "success");
      setCreateOpen(false);
    } catch (error) {
      showToast(toError(error).message, "error");
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <>
      <SettingsRow label={t("workset:ownershipLabel")} htmlFor="chat-workset">
        <div className="flex flex-wrap items-center gap-sm">
          <MenuSelect
            id="chat-workset"
            variant="field"
            menuPortal
            value={worksetId || SYSTEM_WORKSET_ID}
            options={worksetOptions}
            onChange={(next) => onWorksetIdChange(next || SYSTEM_WORKSET_ID)}
            className="min-w-0 flex-1"
            aria-label={t("workset:ownershipLabel")}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            {t("workset:create")}
          </Button>
        </div>
      </SettingsRow>
      <WorksetNameDialog
        open={createOpen}
        mode="create"
        busy={createBusy}
        onClose={() => {
          if (!createBusy) setCreateOpen(false);
        }}
        onSubmit={handleCreateWorkset}
      />
    </>
  );
}
