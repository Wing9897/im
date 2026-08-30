/** Shared schema hard-reject detection / user-facing hint for Desktop process manager. */

import { getShellCopy } from './shell-i18n';

export const SCHEMA_HARD_REJECT_RE =
  /Unsupported database schema version|SchemaBaselineError|schema fingerprint mismatch|Reset required:/i;

export const SCHEMA_FUTURE_STAMP_RE = /Update the application/i;

export type SchemaRejectKind = 'reset_required' | 'future_stamp';

export class SchemaBaselineStartupError extends Error {
  readonly kind: SchemaRejectKind;
  readonly technicalDetail: string;
  readonly exitCode: number | null | undefined;

  constructor(kind: SchemaRejectKind, technicalDetail: string, exitCode?: number | null) {
    super(
      kind === 'future_stamp'
        ? 'Database schema is newer than this application'
        : 'Incompatible database schema',
    );
    this.name = 'SchemaBaselineStartupError';
    this.kind = kind;
    this.technicalDetail = technicalDetail;
    this.exitCode = exitCode;
  }
}

/** Localized schema hard-reject hint for the current UI locale. */
export function schemaHardRejectHint(): string {
  return getShellCopy().schemaHardRejectHint;
}

export function looksLikeSchemaHardReject(stderr: string): boolean {
  return SCHEMA_HARD_REJECT_RE.test(stderr);
}

/**
 * Classify a schema hard-reject. Conservative: only known strings.
 * Future stamps ask the user to update the app; everything else is wipe-only.
 */
export function classifySchemaReject(text: string): SchemaRejectKind | null {
  if (!looksLikeSchemaHardReject(text)) return null;
  if (SCHEMA_FUTURE_STAMP_RE.test(text)) return 'future_stamp';
  return 'reset_required';
}

export function isSchemaBaselineStartupError(err: unknown): err is SchemaBaselineStartupError {
  return err instanceof SchemaBaselineStartupError;
}

/** Parse stderr or a thrown Error into a schema-reject payload when possible. */
export function classifyStartupSchemaFailure(err: unknown): {
  kind: SchemaRejectKind;
  detail: string;
  exitCode: number | null | undefined;
} | null {
  if (isSchemaBaselineStartupError(err)) {
    return { kind: err.kind, detail: err.technicalDetail, exitCode: err.exitCode };
  }
  const text = err instanceof Error ? err.message : String(err);
  const kind = classifySchemaReject(text);
  if (!kind) return null;
  const codeMatch = text.match(/\bcode\s+(\d+)\b/i);
  return {
    kind,
    detail: text,
    exitCode: codeMatch ? Number(codeMatch[1]) : undefined,
  };
}
