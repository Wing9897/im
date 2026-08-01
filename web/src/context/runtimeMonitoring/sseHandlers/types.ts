import type { RuntimeStateBundle } from "../stateManagement";
import type { RuntimeMonitoringOptions } from "../types";

export interface EventListenerDeps {
  state: RuntimeStateBundle;
  options: RuntimeMonitoringOptions;
  refreshQueueStatus: (logPauseChanges: boolean) => void;
  refreshAiStatus: (logOnChange: boolean) => void;
  refreshLogsForBackendEvent: () => void;
}
