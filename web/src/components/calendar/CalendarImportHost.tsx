/** Global host for the Desktop raw-ICS preview and commit wizard. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  commitCalendarImport,
  previewCalendarImport,
  type CalendarImportCommit,
  type CalendarImportPreview,
  type CalendarImportPreviewItem,
  type CalendarImportWarning,
} from "../../api/calendarImports";
import { ModalDialog } from "../ModalDialog";
import { Button } from "../ui";
import { CheckboxField } from "../ui/CheckboxField";
import { useToast } from "../../context/ToastContext";
import { emitResourceModified } from "../../domain/sse/resourceModified";
import {
  getElectronCalendarImport,
  type CalendarImportPayload,
  type CalendarImportMessage,
} from "../../electron/calendarImport";
import { isElectronDesktop } from "../../electron/electronWindow";

function displayValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function WarningList({ warnings }: { warnings: CalendarImportWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="m-0 flex list-disc flex-col gap-xs pl-lg text-caption text-warning">
      {warnings.map((warning, index) => (
        <li key={`${warning.code}-${index}`}>
          {warning.message}
        </li>
      ))}
    </ul>
  );
}

/** Outer gate — no TaskCatalog dependency when not in the Desktop shell. */
export function CalendarImportHost() {
  if (!isElectronDesktop()) return null;
  return <CalendarImportHostInner />;
}

function CalendarImportHostInner() {
  const { t } = useTranslation("timeline");
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<CalendarImportPayload | null>(null);
  const [preview, setPreview] = useState<CalendarImportPreview | null>(null);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CalendarImportCommit | null>(null);
  const requestSequence = useRef(0);

  const applyMessage = useCallback(
    (message: CalendarImportMessage) => {
      if (!message.ok) {
        showToast(message.error || t("calendarImport.importFailed"), "error");
        return;
      }
      const sequence = ++requestSequence.current;
      const nextPayload = message.payload;
      setPayload(nextPayload);
      setPreview(null);
      setResult(null);
      setSelectedUids(new Set());
      setError(null);
      setOpen(true);
      setBusy(true);
      void previewCalendarImport({
        content: nextPayload.content,
        sourceId: nextPayload.sourceId,
      })
        .then((nextPreview) => {
          if (sequence !== requestSequence.current) return;
          setPreview(nextPreview);
          setSelectedUids(
            new Set(
              nextPreview.items
                .filter((item) => item.supported)
                .map((item) => item.uid),
            ),
          );
        })
        .catch((previewError) => {
          if (sequence !== requestSequence.current) return;
          setError(
            previewError instanceof Error
              ? previewError.message
              : t("calendarImport.previewFailed"),
          );
        })
        .finally(() => {
          if (sequence === requestSequence.current) setBusy(false);
        });
    },
    [showToast, t],
  );

  useEffect(() => {
    const api = getElectronCalendarImport();
    if (!api) return;

    let cancelled = false;
    void api.getPending().then((pending) => {
      if (!cancelled && pending) applyMessage(pending);
    });
    const unsubscribe = api.onImport((message) => {
      applyMessage(message);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [applyMessage]);

  const close = useCallback(() => {
    if (busy) return;
    requestSequence.current += 1;
    setOpen(false);
    setPayload(null);
    setPreview(null);
    setResult(null);
    setSelectedUids(new Set());
    setError(null);
  }, [busy]);

  const toggleSelection = useCallback((uid: string, selected: boolean) => {
    setSelectedUids((current) => {
      const next = new Set(current);
      if (selected) next.add(uid);
      else next.delete(uid);
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    if (!payload || !preview) return;
    const selections = preview.items
      .filter((item) => item.supported && selectedUids.has(item.uid))
      .map((item) => ({ uid: item.uid, fingerprint: item.fingerprint }));
    if (selections.length === 0) {
      setError(t("calendarImport.selectAtLeastOne"));
      return;
    }
      setBusy(true);
      setError(null);
      try {
        const committed = await commitCalendarImport({
          content: payload.content,
          sourceId: payload.sourceId,
          selections,
        });
        setResult(committed);
        const invalidatedTypes = new Set<string>();
        for (const item of committed.results) {
          if (item.action === "unchanged") continue;
          const resourceType =
            item.targetType === "recurring_task" ? "task" : "user_event";
          if (invalidatedTypes.has(resourceType)) continue;
          invalidatedTypes.add(resourceType);
          emitResourceModified({
            resourceType,
            resourceId: item.targetId,
            action: item.action === "updated" ? "updated" : "created",
          });
        }
        showToast(
          t("calendarImport.importSaved", { count: committed.committedCount }),
          "success",
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("calendarImport.commitFailed"),
        );
      } finally {
        setBusy(false);
      }
  }, [payload, preview, selectedUids, showToast, t]);

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
          <CommitResults result={result} preview={preview} />
        ) : preview ? (
          <PreviewItems
            preview={preview}
            selectedUids={selectedUids}
            onToggle={toggleSelection}
          />
        ) : null}
      </div>
    </ModalDialog>
  );
}

function PreviewItems({
  preview,
  selectedUids,
  onToggle,
}: {
  preview: CalendarImportPreview;
  selectedUids: ReadonlySet<string>;
  onToggle: (uid: string, selected: boolean) => void;
}) {
  const { t } = useTranslation("timeline");
  return (
    <>
      <section className="flex flex-col gap-xs">
        <h3 className="m-0 text-body font-semibold text-text-primary">
          {preview.calendarName || t("calendarImport.unnamedCalendar")}
        </h3>
        <p className="m-0 text-caption text-text-muted">
          {t("calendarImport.previewSummary", {
            count: preview.eventCount,
            importable: preview.importableCount,
          })}
        </p>
        <WarningList warnings={preview.warnings} />
      </section>
      <div className="flex flex-col gap-sm" data-testid="calendar-import-items">
        {preview.items.map((item, index) => (
          <PreviewItem
            key={`${item.uid}-${index}`}
            item={item}
            selected={selectedUids.has(item.uid)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </>
  );
}

function PreviewItem({
  item,
  selected,
  onToggle,
}: {
  item: CalendarImportPreviewItem;
  selected: boolean;
  onToggle: (uid: string, selected: boolean) => void;
}) {
  const { t } = useTranslation("timeline");
  return (
    <article
      className="flex flex-col gap-sm rounded-lg border border-surface-border bg-surface-card p-md"
      data-testid={`calendar-import-item-${item.uid}`}
    >
      <CheckboxField
        checked={selected}
        disabled={!item.supported}
        onChange={(event) => onToggle(item.uid, event.target.checked)}
        label={
          <span className="flex flex-col gap-xs">
            <span className="font-medium">{item.title}</span>
            <span className="text-caption text-text-muted">
              {t(`calendarImport.target.${item.targetType}`)} ·{" "}
              {t(`calendarImport.action.${item.action}`)}
            </span>
          </span>
        }
      />
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-md gap-y-xs text-caption">
        <dt className="text-text-muted">{t("calendarImport.start")}</dt>
        <dd className="m-0 break-all text-text-primary">{item.startTime}</dd>
        <dt className="text-text-muted">{t("calendarImport.end")}</dt>
        <dd className="m-0 break-all text-text-primary">{item.endTime || "—"}</dd>
        <dt className="text-text-muted">{t("calendarImport.time")}</dt>
        <dd className="m-0 text-text-primary">
          {item.isAllDay
            ? t("calendarImport.allDay")
            : item.timezone || t("calendarImport.systemTimezone")}
        </dd>
        {item.rrule ? (
          <>
            <dt className="text-text-muted">{t("calendarImport.rrule")}</dt>
            <dd className="m-0 break-all text-text-primary">{item.rrule}</dd>
          </>
        ) : null}
      </dl>
      {item.exdates.length || item.rdates.length ? (
        <p className="m-0 text-caption text-text-muted">
          {t("calendarImport.recurrenceExceptions", {
            excluded: item.exdates.length,
            added: item.rdates.length,
          })}
        </p>
      ) : null}
      {item.changes.length ? (
        <div className="flex flex-col gap-xs">
          <p className="m-0 text-caption font-medium text-text-primary">
            {t("calendarImport.changes")}
          </p>
          <ul className="m-0 flex list-disc flex-col gap-xs pl-lg text-caption text-text-secondary">
            {item.changes.map((change) => (
              <li key={change.field}>
                {change.field}: {displayValue(change.before)} → {displayValue(change.after)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <WarningList warnings={item.warnings} />
    </article>
  );
}

function CommitResults({
  result,
  preview,
}: {
  result: CalendarImportCommit;
  preview: CalendarImportPreview;
}) {
  const { t } = useTranslation("timeline");
  const titles = new Map(preview.items.map((item) => [item.uid, item.title]));
  return (
    <section className="flex flex-col gap-sm" data-testid="calendar-import-results">
      <h3 className="m-0 text-body font-semibold text-text-primary">
        {t("calendarImport.resultTitle")}
      </h3>
      <p className="m-0 text-caption text-text-muted">
        {t("calendarImport.resultSummary", {
          count: result.committedCount,
          created: result.createdCount,
          updated: result.updatedCount,
          unchanged: result.unchangedCount,
        })}
      </p>
      <ul className="m-0 flex list-none flex-col gap-xs p-0">
        {result.results.map((item) => (
          <li
            key={`${item.uid}-${item.targetId}`}
            className="rounded-lg border border-surface-border bg-surface-card px-md py-sm text-caption"
          >
            <span className="font-medium text-text-primary">
              {titles.get(item.uid) || item.uid}
            </span>
            <span className="text-text-muted">
              {" "}
              · {t(`calendarImport.target.${item.targetType}`)} ·{" "}
              {t(`calendarImport.resultAction.${item.action}`)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
