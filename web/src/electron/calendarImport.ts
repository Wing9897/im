/**
 * Desktop calendar import bridge (preload `window.electronCalendarImport`).
 */

export type CalendarImportPayload = {
  content: string;
  sourceId: string;
  source: "file" | "url" | "deeplink";
  sourceLabel: string;
};

export type CalendarImportMessage =
  | { ok: true; payload: CalendarImportPayload }
  | { ok: false; error: string; sourceLabel?: string };

export interface ElectronCalendarImportApi {
  getPending: () => Promise<CalendarImportMessage | null>;
  onImport: (callback: (message: CalendarImportMessage) => void) => () => void;
}

declare global {
  interface Window {
    electronCalendarImport?: ElectronCalendarImportApi;
  }
}

export function getElectronCalendarImport(): ElectronCalendarImportApi | undefined {
  return typeof window !== "undefined" ? window.electronCalendarImport : undefined;
}
