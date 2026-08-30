import { describe, expect, it } from 'vitest';
import {
  classifySchemaReject,
  classifyStartupSchemaFailure,
  looksLikeSchemaHardReject,
  SchemaBaselineStartupError,
} from '../process-manager-schema';

const FLOOR_TRACE = `Traceback (most recent call last):
  File "server/main.py", line 179, in lifespan
SchemaBaselineError: Unsupported database schema version 2; floor 6
`;

const FUTURE_TRACE =
  'Unsupported database schema version 27; this application supports stamp 6. Update the application. Reset is a last resort: python scripts/reset_local_databases.py --apply';

describe('process-manager-schema', () => {
  it('detects packaged stamp-2 floor rejects from stderr', () => {
    expect(looksLikeSchemaHardReject(FLOOR_TRACE)).toBe(true);
    expect(classifySchemaReject(FLOOR_TRACE)).toBe('reset_required');
  });

  it('classifies future stamps separately from wipe-only floor rejects', () => {
    expect(classifySchemaReject(FUTURE_TRACE)).toBe('future_stamp');
  });

  it('does not treat unrelated startup failures as schema rejects', () => {
    expect(classifySchemaReject('Application startup failed: Address already in use')).toBeNull();
    expect(looksLikeSchemaHardReject('exit code 3')).toBe(false);
  });

  it('unwraps SchemaBaselineStartupError without putting the traceback in message', () => {
    const err = new SchemaBaselineStartupError('reset_required', FLOOR_TRACE, 3);
    expect(err.message).toBe('Incompatible database schema');
    expect(err.message).not.toMatch(/Traceback|SchemaBaselineError/);
    expect(classifyStartupSchemaFailure(err)).toEqual({
      kind: 'reset_required',
      detail: FLOOR_TRACE,
      exitCode: 3,
    });
  });

  it('conservatively parses a dumped traceback Error from older shells', () => {
    const err = new Error(
      `Server process exited during startup (code 3).\n\n${FLOOR_TRACE}`,
    );
    const parsed = classifyStartupSchemaFailure(err);
    expect(parsed?.kind).toBe('reset_required');
    expect(parsed?.exitCode).toBe(3);
    expect(parsed?.detail).toContain('Unsupported database schema version 2');
  });
});
