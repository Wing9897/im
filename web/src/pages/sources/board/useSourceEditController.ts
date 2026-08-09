import { useCallback, useState } from "react";

interface SourceEditControllerOptions<TTarget, TForm> {
  toForm: (target: TTarget) => TForm;
  validate?: (form: TForm, target: TTarget) => string | null;
  save: (target: TTarget, form: TForm) => Promise<void>;
  refresh: () => Promise<void>;
  formatError: (error: unknown) => string;
}

/** Shared target/form/busy/error lifecycle for source edit dialogs. */
export function useSourceEditController<TTarget, TForm>({
  toForm,
  validate,
  save,
  refresh,
  formatError,
}: SourceEditControllerOptions<TTarget, TForm>) {
  const [editTarget, setEditTarget] = useState<TTarget | null>(null);
  const [editForm, setEditForm] = useState<TForm | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditDialog = useCallback(
    (target: TTarget) => {
      setEditTarget(target);
      setEditForm(toForm(target));
      setEditError(null);
    },
    [toForm],
  );

  const closeEditDialog = useCallback(() => {
    setEditTarget(null);
    setEditForm(null);
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editTarget || !editForm) return;
    setEditError(null);
    const validationError = validate?.(editForm, editTarget) ?? null;
    if (validationError) {
      setEditError(validationError);
      return;
    }

    setEditSubmitting(true);
    try {
      await save(editTarget, editForm);
      closeEditDialog();
      await refresh();
    } catch (error) {
      setEditError(formatError(error));
    } finally {
      setEditSubmitting(false);
    }
  }, [
    closeEditDialog,
    editForm,
    editTarget,
    formatError,
    refresh,
    save,
    validate,
  ]);

  return {
    editTarget,
    editForm,
    setEditForm,
    editSubmitting,
    editError,
    openEditDialog,
    closeEditDialog,
    handleSaveEdit,
  };
}
