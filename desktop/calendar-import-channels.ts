/**
 * IPC channel names for Desktop calendar import (.ics / deep link).
 * Preload must keep an identical self-contained copy — see preload-channels.test.ts.
 */
export const CALENDAR_IMPORT_CHANNELS = {
  /** Renderer → main: drain any queued import (cold start / race). */
  getPending: 'calendar-import:get-pending',
  /** Main → renderer: push a parsed draft or error. */
  onImport: 'calendar-import:event',
} as const;

/** Custom URL scheme registered with the OS (packaged + protocol client). */
export const CALENDAR_IMPORT_PROTOCOL = 'intelligencemonitor';
