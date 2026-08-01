/** Global host for the Desktop raw-ICS preview and commit wizard. */

import { useTranslation } from "react-i18next";

import { ModalDialog } from "../ModalDialog";
import { Button } from "../ui";
import { isElectronDesktop } from "../../electron/electronWindow";
import { CalendarImportPreview } from "./CalendarImportPreview";
import { CalendarImportResult } from "./CalendarImportResult";
import { useCalendarImportFlow } from "./useCalendarImportFlow";

/** Outer gate — no TaskCatalog dependency when not in the Desktop shell. */
export function CalendarImportHost() {
  if (!isElectronDesktop()) return null;
  return <CalendarImportHostInner />;
}

function CalendarImportHostInner() {
  const { t } = useTranslation("timeline");
  const {
    open,
    busy,
    error,
    payload,
    preview,
    selectedUids,
    result,
    close,
    toggleSelection,
    selectAllImportable,
    clearSelection,
    submit,
  } = useCalendarImportFlow();

  return (
    <ModalDialog
      open={open}
      title={t("calendarImport.title")}
      closeAriaLabel={t("calendarImport.closeAria")}
      onClose={close}
      testId="calendar-import-dialog"
      size="form"
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            {t("calendarImport.done")}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close} disabled={busy}>
              {t("calendarImport.cancel")}
            </Button>
            <Button
              variant="primary"
              onClick={() => void submit()}
              disabled={busy || !preview || selectedUids.size === 0}
            >
              {busy
                ? t(preview ? "calendarImport.committing" : "calendarImport.previewing")
                : t("calendarImport.commit", { count: selectedUids.size })}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-md">
        {payload ? (
          <section className="rounded-lg border border-surface-border bg-surface-card p-md">
            <p className="m-0 text-body font-medium text-text-primary">
              {payload.sourceLabel}
            </p>
            <p className="m-0 mt-xs text-caption text-text-muted">
              {t("calendarImport.sourceSummary", {
                source: t(`calendarImport.source.${payload.source}`),
                size: new TextEncoder().encode(payload.content).byteLength,
              })}
            </p>
          </section>
        ) : null}

        {busy && !preview ? (
          <p className="m-0 text-body text-text-muted" role="status">
            {t("calendarImport.previewing")}
          </p>
        ) : null}
        {error ? (
          <p className="m-0 text-caption text-error" role="alert">
            {error}
          </p>
        ) : null}

        {result && preview ? (
          <CalendarImportResult result={result} preview={preview} />
        ) : preview ? (
          <CalendarImportPreview
            preview={preview}
            selectedUids={selectedUids}
            onToggle={toggleSelection}
            onSelectAll={selectAllImportable}
            onClearSelection={clearSelection}
            busy={busy}
          />
        ) : null}
      </div>
    </ModalDialog>
  );
}
