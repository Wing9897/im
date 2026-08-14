import type { CollectorStatus } from "../../types";
import {
  getCollectorStatusLabelsLong,
  getCollectorStatusLabelsShort,
} from "../../utils/collector";

/**
 * Static colour / label maps for the collector status indicator in the top bar.
 *
 * AI engine status is computed inline in AppTopBar.tsx using the three-state
 * model: OK (green) / analyzing (blue) / offline (red).
 */

export const statusColorsByCollectorState: Record<CollectorStatus, string> = {
  running: "var(--success)",
  stopped: "var(--error)",
  error: "var(--error)",
};

export function statusLabelsByCollectorState(): Record<CollectorStatus, string> {
  return getCollectorStatusLabelsLong();
}

export function statusShortLabelsByCollectorState(): Record<CollectorStatus, string> {
  return getCollectorStatusLabelsShort();
}
