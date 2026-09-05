/** Preview list + selection controls for calendar import wizard. */

import { useTranslation } from "react-i18next";

import type {
  CalendarImportPreview as CalendarImportPreviewData,
  CalendarImportPreviewItem,
  CalendarImportWarning,
} from "../../api/calendarImports";
import { Button } from "../ui";
import { CheckboxField } from "../ui/CheckboxField";
import { formatDateTime } from "../../domain/timeline/dateUtils";

function isoDatePart(iso: string): string {
  return iso.slice(0, 10);
}

/** Format preview when-line without dumping raw ISO / timezone internals. */
function formatImportWhen(item: CalendarImportPreviewItem): string {
  if (item.isAllDay) {
    const start = isoDatePart(item.startTime);
    if (!item.endTime) return start;
    const exclusiveEnd = isoDatePart(item.endTime);
    const endMs = Date.parse(`${exclusiveEnd}T00:00:00Z`);
    if (!Number.isFinite(endMs)) return start;
    const inclusiveEnd = new Date(endMs - 86_400_000).toISOString().slice(0, 10);
    if (inclusiveEnd <= start) return start;
    return `${start} – ${inclusiveEnd}`;
  }
  const startMs = Date.parse(item.startTime);
  const startLabel = Number.isFinite(startMs) ? formatDateTime(startMs) : item.startTime;
  if (!item.endTime) return startLabel;
  const endMs = Date.parse(item.endTime);
  const endLabel = Number.isFinite(endMs) ? formatDateTime(endMs) : item.endTime;
  return `${startLabel} – ${endLabel}`;
}

function WarningList({ warnings }: { warnings: CalendarImportWarning[] }) {
  const visible = warnings.filter(
    (warning) => !/uid/i.test(warning.code) && !/\bUID\b/.test(warning.message),
  );
  if (visible.length === 0) return null;
  return (
    <ul className="m-0 flex list-disc flex-col gap-xs pl-lg text-caption text-warning">
      {visible.map((warning, index) => (
        <li key={`${warning.code}-${index}`}>{warning.message}</li>
      ))}
    </ul>
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
  const whenLabel = formatImportWhen(item);
  const typeLabel = t(`calendarImport.target.${item.targetType}`);
  const timeKind = item.isAllDay
    ? t("calendarImport.allDay")
    : t("calendarImport.timed");
  return (
    <article
      className="im-surface-panel flex flex-col gap-xs rounded-lg border border-surface-border p-md"
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
              {typeLabel}
              {" · "}
              {timeKind}
              {item.supported
                ? ` · ${t(`calendarImport.action.${item.action}`)}`
                : ` · ${t("calendarImport.action.unsupported")}`}
            </span>
            <span className="text-caption text-text-secondary">{whenLabel}</span>
          </span>
        }
      />
      <WarningList warnings={item.warnings} />
    </article>
  );
}

export function CalendarImportPreview({
  preview,
  selectedUids,
  onToggle,
  onSelectAll,
  onClearSelection,
  busy,
}: {
  preview: CalendarImportPreviewData;
  selectedUids: ReadonlySet<string>;
  onToggle: (uid: string, selected: boolean) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  busy: boolean;
}) {
  const { t } = useTranslation("timeline");
  const importableCount = preview.items.filter((item) => item.supported).length;
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
        {importableCount > 0 ? (
          <div className="mt-xs flex flex-wrap gap-sm">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onSelectAll}
              disabled={busy}
              data-testid="calendar-import-select-all"
            >
              {t("calendarImport.selectAll")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              disabled={busy || selectedUids.size === 0}
              data-testid="calendar-import-clear-selection"
            >
              {t("calendarImport.clearSelection")}
            </Button>
          </div>
        ) : null}
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
