/**
 * Anti-regression: FE new recurring creates must use atomic POST /tasks/recurring.
 * Do not reintroduce shell ``POST /tasks`` + ``PUT /schedule`` for web/timeline creates.
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
  it("tasks API posts atomic create only to /tasks/recurring", () => {
    const source = readSrc("api/tasks.ts");
    expect(source).toContain('"/api/v1/tasks/recurring"');
    expect(source).toMatch(
      /createRecurringTask[\s\S]*?apiClient\.post[\s\S]*?\/api\/v1\/tasks\/recurring/,
    );
  });

  it("task editor + timeline create paths call createRecurringTask (not createTask shell)", () => {
    const persistence = readSrc("hooks/useTaskPersistence.ts");
    expect(persistence).toMatch(/createRecurringTask\s*\(/);
    expect(persistence).toMatch(/formStateToCreateRecurringConfig/);
    // New recurring must not fall through to createTask.
    expect(persistence).toMatch(
      /analysisMode\s*===\s*["']recurring["'][\s\S]*?createRecurringTask/,
    );

    const timeline = readSrc("domain/timeline/createRecurringTimelineEvent.ts");
    expect(timeline).toMatch(/createRecurringTask\s*\(/);
    expect(timeline).not.toMatch(/createTask\s*\(/);
    expect(timeline).not.toMatch(/putTaskSchedule\s*\(/);
  });

  it("CreateRecurringTaskConfig / TaskSchedule* alias OpenAPI schema types", () => {
    const tasksApi = readSrc("api/tasks.ts");
    expect(tasksApi).toMatch(
      /CreateRecurringTaskConfig\s*=\s*components\["schemas"\]\["CreateRecurringTaskBody"\]/,
    );

    const scheduleApi = readSrc("api/taskSchedule.ts");
    expect(scheduleApi).toMatch(
      /TaskSchedule\s*=\s*components\["schemas"\]\["TaskScheduleResponse"\]/,
    );
    expect(scheduleApi).toMatch(
      /TaskScheduleConfig\s*=\s*components\["schemas"\]\["TaskScheduleBody"\]/,
    );
  });
});
