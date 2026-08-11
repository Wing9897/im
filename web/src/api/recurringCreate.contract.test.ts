/**
 * Anti-regression: recurring series use calendar CRUD, never task endpoints.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(rel: string): string {
  return readFileSync(resolve(SRC_ROOT, rel), "utf8");
}

describe("recurring create FE contract", () => {
  it("recurring API owns calendar CRUD", () => {
    const source = readSrc("api/recurringSeries.ts");
    expect(source).toContain('"/api/v1/calendar/recurring"');
    expect(source).toMatch(/createRecurringSeries/);
    expect(source).toMatch(/patchRecurringSeries/);
    expect(source).toMatch(/deleteRecurringSeries/);
  });

  it("task editor stays analysis-only while timeline uses calendar create", () => {
    const persistence = readSrc("hooks/useTaskPersistence.ts");
    expect(persistence).not.toMatch(/createRecurringTask|createRecurringSeries/);
    expect(persistence).toMatch(/createTask|updateTask/);
    expect(persistence).not.toMatch(/analysisMode\s*[:=]\s*["']recurring["']/);

    const timeline = readSrc("domain/timeline/createRecurringTimelineEvent.ts");
    expect(timeline).toMatch(/createRecurringSeries\s*\(/);
    expect(timeline).not.toMatch(/createTask\s*\(/);

    const scheduleEditor = readSrc("pages/schedule/RecurringSeriesEditor.tsx");
    expect(scheduleEditor).toMatch(/patchRecurringSeries|getRecurringSeries/);
  });

  it("removes task recurring and schedule clients", () => {
    const tasksApi = readSrc("api/tasks.ts");
    expect(tasksApi).not.toMatch(/tasks\/recurring|createRecurringTask/);
  });
});
