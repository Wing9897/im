/** Shared schema hard-reject detection / user-facing hint for Desktop process manager. */

import { getShellCopy } from './shell-i18n';

export const SCHEMA_HARD_REJECT_RE =
  /Unsupported database schema version|SchemaBaselineError|schema fingerprint mismatch/i;

/** Localized schema hard-reject hint for the current UI locale. */
export function schemaHardRejectHint(): string {
  return getShellCopy().schemaHardRejectHint;
}

export function looksLikeSchemaHardReject(stderr: string): boolean {
  return SCHEMA_HARD_REJECT_RE.test(stderr);
}
