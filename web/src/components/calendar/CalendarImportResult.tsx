/** Commit summary panel for calendar import wizard. */

import { useTranslation } from "react-i18next";

import type {
  CalendarImportCommit,
  CalendarImportPreview,
} from "../../api/calendarImports";

export function CalendarImportResult({
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
              {titles.get(item.uid) || t("calendarImport.unnamedEvent")}
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
