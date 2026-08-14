import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  ANALYSIS_COMPLETED_FIELDS,
  ANALYSIS_FAILED_FIELDS,
  DESKTOP_ONLY_COMPLETED_FIELDS,
} from '../sse-payloads';

/**
 * The desktop shell cannot import the web generated OpenAPI types, so the
 * analysis SSE payload shapes are mirrored in `desktop/sse-payloads.ts`.
 * This locks the mirror against the exported schema.
 */
const OPENAPI_PATH = resolve(__dirname, '../../web/openapi/openapi.json');

interface OpenApiDocument {
  components: {
    schemas: Record<string, { properties?: Record<string, unknown> }>;
  };
}

function schemaFields(component: string): string[] {
  const doc = JSON.parse(readFileSync(OPENAPI_PATH, 'utf8')) as OpenApiDocument;
  const schema = doc.components.schemas[component];
  expect(schema, `${component} missing from exported OpenAPI`).toBeDefined();
  return Object.keys(schema.properties ?? {}).sort();
}

describe('desktop SSE payload mirrors', () => {
  it('analysis_completed mirror matches SseAnalysisCompletedPayload', () => {
    const desktopOnly = new Set<string>(DESKTOP_ONLY_COMPLETED_FIELDS);
    const mirrored = ANALYSIS_COMPLETED_FIELDS.filter((f) => !desktopOnly.has(f)).sort();
    expect(mirrored).toEqual(schemaFields('SseAnalysisCompletedPayload'));
  });

  it('analysis_failed mirror matches SseAnalysisFailedPayload', () => {
    expect([...ANALYSIS_FAILED_FIELDS].sort()).toEqual(schemaFields('SseAnalysisFailedPayload'));
  });

  it('desktop-only fields are absent from the server schema', () => {
    const serverFields = new Set(schemaFields('SseAnalysisCompletedPayload'));
    for (const field of DESKTOP_ONLY_COMPLETED_FIELDS) {
      expect(serverFields.has(field)).toBe(false);
    }
  });
});
