/**
 * Create / rename workset name dialog (Electron-safe; no window.prompt).
 */

import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "../ModalDialog";
import { Button, TextField } from "../ui";

export type WorksetNameDialogMode = "create" | "rename";

interface WorksetNameDialogProps {
  open: boolean;
  mode: WorksetNameDialogMode;
  /** Prefill for rename; ignored when closed. */
  initialName?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
}

/** Compact name form for creating or renaming a workset. */
export function WorksetNameDialog({
  open,
  mode,
  initialName = "",
  busy = false,
  onClose,
  onSubmit,
}: WorksetNameDialogProps) {
  const { t } = useTranslation("common");
  const fieldId = useId();
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(mode === "rename" ? initialName : "");
    setSubmitting(false);
  }, [open, mode, initialName]);

  if (!open) return null;

  const disabled = busy || submitting;
  const cleaned = name.trim();
  const canSubmit =
    cleaned.length > 0 && (mode === "create" || cleaned !== initialName.trim());

  const handleSubmit = async () => {
    if (!canSubmit || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit(cleaned);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalDialog
      open={open}
      title={mode === "create" ? t("workset:createTitle") : t("workset:renameTitle")}
      closeAriaLabel={t("dialog.close")}
      onClose={() => {
        if (!disabled) onClose();
      }}
      testId="workset-name-dialog"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>
            {t("dialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => void handleSubmit()}
            disabled={disabled || !canSubmit}
            data-testid="workset-name-submit"
          >
            {mode === "create" ? t("workset:createSubmit") : t("workset:renameSubmit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-sm">
        {mode === "create" ? (
          <p className="m-0 text-caption text-text-muted">{t("workset:createHint")}</p>
        ) : null}
        <label className="text-caption text-text-secondary" htmlFor={fieldId}>
          {t("workset:nameLabel")}
        </label>
        <TextField
          id={fieldId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("workset:namePlaceholder")}
          aria-label={t("workset:nameAria")}
          className="w-full"
          autoFocus
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          data-testid="workset-name-input"
        />
      </div>
    </ModalDialog>
  );
}
