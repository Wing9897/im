import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(__dirname, "..");

const RETIRED_SOURCE_PATHS = [
  "css/ops-board.css",
  "pages/actions/NotificationUI.test.tsx",
  "components/common/ViewToggle.tsx",
  "components/settings/OverlapSlider.tsx",
  "pages/tasks/chat-editor/OverlapSlider.tsx",
  "pages/tasks/chat-editor/OverlapSlider.test.tsx",
  "components/CalendarImportHost.tsx",
  "pages/logs/resolveLogDisplayMessage.ts",
  "pages/timeline/gantt/groupRecurringGanttRows.ts",
  "components/PageToolbar.tsx",
  "board/boardPersistedKeys.ts",
  "board/boardLegacyPersistedKeys.ts",
  "api/httpCore.ts",
  "domain/intelligence/intelligenceSourceFilter.ts",
  "domain/timeline/timelineSourceFilter.ts",
  "pages/timeline/timelinePanelKeys.ts",
  "pages/profile",
  "pages/tasks/chat-editor/useProjectWaveInterval.ts",
  "pages/timeline/components/UserEventDialog.tsx",
  "utils/datetime.ts",
] as const;

describe("retired source paths", () => {
  it.each(RETIRED_SOURCE_PATHS)("%s stays retired", (relativePath) => {
    expect(existsSync(resolve(SRC_DIR, relativePath))).toBe(false);
  });
});
