import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

import {
  ANALYSIS_COMPLETED_FIELDS,
  ANALYSIS_FAILED_FIELDS,
  ANALYSIS_PAUSED_CHANGED_FIELDS,
  ANALYSIS_STARTED_FIELDS,
  COLLECTOR_STATUS_CHANGED_FIELDS,
  DESKTOP_ONLY_COMPLETED_FIELDS,
  MESSAGES_UPDATED_FIELDS,
  OVERLAP_STATISTICS_FIELDS,
  RESOURCE_MODIFIED_FIELDS,
  SOURCE_STATUS_CHANGED_FIELDS,
} from '../sse-payloads';

/**
 * The desktop shell cannot import the web generated OpenAPI types, so the
 * SSE payload shapes are mirrored in `desktop/sse-payloads.ts`.
 * This locks each mirror against the exported schema (the three copies stay
 * separate: server Pydantic, web generated types, desktop field tuples).
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

function expectMirror(component: string, fields: readonly string[], desktopOnly: readonly string[] = []) {
  const extra = new Set(desktopOnly);
  const mirrored = fields.filter((f) => !extra.has(f)).sort();
  expect(mirrored).toEqual(schemaFields(component));
}

describe('desktop SSE payload mirrors', () => {
  it('analysis_completed mirror matches SseAnalysisCompletedPayload', () => {
    expectMirror('SseAnalysisCompletedPayload', ANALYSIS_COMPLETED_FIELDS, DESKTOP_ONLY_COMPLETED_FIELDS);
  });

  it('analysis_failed mirror matches SseAnalysisFailedPayload', () => {
    expectMirror('SseAnalysisFailedPayload', ANALYSIS_FAILED_FIELDS);
  });

  it('analysis_started mirror matches SseAnalysisStartedPayload', () => {
    expectMirror('SseAnalysisStartedPayload', ANALYSIS_STARTED_FIELDS);
  });

  it('analysis_paused_changed mirror matches SseAnalysisPausedChangedPayload', () => {
    expectMirror('SseAnalysisPausedChangedPayload', ANALYSIS_PAUSED_CHANGED_FIELDS);
  });

  it('collector_status_changed mirror matches SseCollectorStatusChangedPayload', () => {
    expectMirror('SseCollectorStatusChangedPayload', COLLECTOR_STATUS_CHANGED_FIELDS);
  });

  it('source_status_changed mirror matches SseSourceStatusChangedPayload', () => {
    expectMirror('SseSourceStatusChangedPayload', SOURCE_STATUS_CHANGED_FIELDS);
  });

  it('resource_modified mirror matches SseResourceModifiedPayload', () => {
    expectMirror('SseResourceModifiedPayload', RESOURCE_MODIFIED_FIELDS);
  });

  it('messages_updated mirror matches SseMessagesUpdatedPayload', () => {
    expectMirror('SseMessagesUpdatedPayload', MESSAGES_UPDATED_FIELDS);
  });

  it('overlap statistics mirror matches SseOverlapStatistics', () => {
    expectMirror('SseOverlapStatistics', OVERLAP_STATISTICS_FIELDS);
  });

  it('desktop-only fields are absent from the server schema', () => {
    const serverFields = new Set(schemaFields('SseAnalysisCompletedPayload'));
    for (const field of DESKTOP_ONLY_COMPLETED_FIELDS) {
      expect(serverFields.has(field)).toBe(false);
    }
  });
});
