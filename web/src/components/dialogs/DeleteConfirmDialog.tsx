import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  targetName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  deleting: boolean;
  /** Dialog title override (defaults to delete-task title). */
  title?: string;
  /** Entity noun in body copy (defaults to “task”). */
  entityLabel?: string;
}

/** Delete-flavoured preset over {@link ConfirmDialog}. */
export function DeleteConfirmDialog({
  open,
  targetName,
  onConfirm,
  onCancel,
  deleting,
  title,
  entityLabel,
}: DeleteConfirmDialogProps) {
  const { t } = useTranslation("common");
  if (!open) return null;

  const resolvedTitle = title ?? t("dialog.deleteConfirmTitle");
  const resolvedEntity = entityLabel ?? t("dialog.deleteEntityTask");

  return (
    <ConfirmDialog
      title={resolvedTitle}
      body={
        <>
          {t("dialog.deleteConfirmPrefix", { entity: resolvedEntity })}{" "}
          <strong className="text-text-primary">{targetName}</strong>{" "}
          {t("dialog.deleteConfirmSuffix")}
        </>
      }
      confirmLabel={t("dialog.confirmDelete")}
      confirmBusyLabel={t("dialog.deleting")}
      busy={deleting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
