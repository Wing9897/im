/**
 * Create / rename workset dialog (Electron-safe; no window.prompt).
 * Create accepts optional cover + description; system rename locks the name.
 */

import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModalDialog } from "../ModalDialog";
import { Button, TextArea, TextField } from "../ui";
import { WORKSET_DESCRIPTION_MAX } from "../../domain/worksets/worksetFields";
import { compressWorksetCoverToDataUrl } from "../../domain/worksets/worksetCover";
import { useToast } from "../../context/ToastContext";
import { WorksetCardCover } from "../WorksetCardCover";

export type WorksetNameDialogMode = "create" | "rename";

export type WorksetEditorValues = {
  name: string;
  description: string;
  cover: string;
};

interface WorksetNameDialogProps {
  open: boolean;
  mode: WorksetNameDialogMode;
  /** Prefill for rename; ignored when closed. */
  initialName?: string;
  initialDescription?: string;
  /** Lock the name field (builtin 「一般」). */
  nameDisabled?: boolean;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (values: WorksetEditorValues) => void | Promise<void>;
}

/** Compact name form for creating or renaming a workset. */
export function WorksetNameDialog({
  open,
  mode,
  initialName = "",
  initialDescription = "",
  nameDisabled = false,
  busy = false,
  onClose,
  onSubmit,
}: WorksetNameDialogProps) {
  const { t } = useTranslation("common");
  const { showToast } = useToast();
  const fieldId = useId();
  const descriptionId = useId();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [cover, setCover] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(mode === "rename" ? initialName : "");
    setDescription(mode === "rename" ? initialDescription : "");
    setCover("");
    setSubmitting(false);
  }, [open, mode, initialName, initialDescription]);

  if (!open) return null;

  const disabled = busy || submitting;
  const cleaned = name.trim();
  const trimmedDescription = description.trim();
  const nameUnchanged = mode === "rename" && cleaned === initialName.trim();
  const descriptionUnchanged =
    mode === "rename" && trimmedDescription === initialDescription.trim();
  const canSubmit =
    cleaned.length > 0 &&
    trimmedDescription.length <= WORKSET_DESCRIPTION_MAX &&
    (mode === "create" || !nameUnchanged || !descriptionUnchanged);

  const handleSubmit = async () => {
    if (!canSubmit || disabled) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name: cleaned,
        description: trimmedDescription,
        cover: cover.trim(),
      });
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
          autoFocus={!nameDisabled}
          disabled={disabled || nameDisabled}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          data-testid="workset-name-input"
        />
        {mode === "create" ? (
          <WorksetCardCover
            cover={cover}
            name={cleaned || t("workset:label")}
            disabled={disabled}
            onPickFile={async (file) => {
              try {
                const dataUrl = await compressWorksetCoverToDataUrl(file);
                setCover(dataUrl);
              } catch (err) {
                const code = err instanceof Error ? err.message : "";
                showToast(
                  code === "too_large" ? t("account:avatarTooLarge") : t("account:avatarReadFailed"),
                  "error",
                );
              }
            }}
            onClear={() => setCover("")}
          />
        ) : null}
        <label className="text-caption text-text-secondary" htmlFor={descriptionId}>
          {t("workset:descriptionLabel")}
        </label>
        <TextArea
          id={descriptionId}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("workset:descriptionPlaceholder")}
          aria-label={t("workset:descriptionAria")}
          maxLength={WORKSET_DESCRIPTION_MAX}
          disabled={disabled}
          className="min-h-[5.5rem]"
          data-testid="workset-description-input"
        />
        <p className="m-0 text-caption text-text-muted">
          {t("workset:descriptionHint", {
            used: trimmedDescription.length,
            max: WORKSET_DESCRIPTION_MAX,
          })}
        </p>
      </div>
    </ModalDialog>
  );
}
