import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type CalendarImportInput = components["schemas"]["CalendarImportInput"];
export type CalendarImportPreview = components["schemas"]["CalendarImportPreviewResponse"];
export type CalendarImportPreviewItem =
  components["schemas"]["CalendarImportPreviewItemResponse"];
export type CalendarImportWarning =
  components["schemas"]["CalendarImportWarningResponse"];
export type CalendarImportSelection =
  components["schemas"]["CalendarImportSelectionBody"];
export type CalendarImportCommit =
  components["schemas"]["CalendarImportCommitResponse"];
export type CalendarImportCommitItem =
  components["schemas"]["CalendarImportCommitItemResponse"];

export function previewCalendarImport(
  input: CalendarImportInput,
): Promise<CalendarImportPreview> {
  return apiClient.post<CalendarImportPreview>(
    "/api/v1/calendar-imports/preview",
    input,
  );
}

export function commitCalendarImport(
  input: CalendarImportInput & { selections: CalendarImportSelection[] },
): Promise<CalendarImportCommit> {
  return apiClient.post<CalendarImportCommit>(
    "/api/v1/calendar-imports/commit",
    input,
  );
}
