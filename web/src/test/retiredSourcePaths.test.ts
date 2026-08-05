import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = resolve(__dirname, "..");

const RETIRED_SOURCE_PATHS = [
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
  "hooks/useTaskForm.ts",
  "hooks/useTaskFormState.ts",
  "hooks/useTaskFormFields.ts",
  "hooks/useTaskFormValidation.ts",
  "hooks/usePersistedEnum.ts",
  "hooks/usePersistedViewMode.ts",
  "hooks/usePersistedMonitorViewMode.ts",
  "pages/intelligence/useReadTracking.ts",
  "context/runtimeLogs/runtimeLogsPersistedKeys.ts",
  "domain/assistant/assistantPersistedKeys.ts",
  "domain/intelligence/intelligencePersistedKeys.ts",
  "domain/monitor/monitorPersistedKeys.ts",
  "domain/tasks/chatEditorPersistedKeys.ts",
  "domain/ui/chromePersistedKeys.ts",
  "electron/electronPersistedKeys.ts",
  "i18n/localePersistedKeys.ts",
  "pages/intelligence/map/mapPersistedKeys.ts",
  "pages/leaderboard/leaderboardPersistedKeys.ts",
  "pages/logs/logsPersistedKeys.ts",
  "pages/monitor/monitorPersistedKeys.ts",
  "pages/sources/discord/discordPersistedKeys.ts",
  "pages/timeline/timelinePersistedKeys.ts",
  "pages/viewer/viewerPersistedKeys.ts",
  "speech/voicePersistedKeys.ts",
  "styles/themePersistedKeys.ts",
  "voiceReminder/voiceReminderPersistedKeys.ts",
  "components/SchemaUpgradeGate.tsx",
] as const;

describe("retired source paths", () => {
  it.each(RETIRED_SOURCE_PATHS)("%s stays retired", (relativePath) => {
    expect(existsSync(resolve(SRC_DIR, relativePath))).toBe(false);
  });
});
