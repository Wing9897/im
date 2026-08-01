// ============================================================
// Viewer (read-only LAN client) Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** Stats summary returned by GET /api/v1/viewer/stats */
export type ViewerStats = components["schemas"]["ViewerStatsResponse"];

/** System status returned by GET /api/v1/viewer/status */
export type ViewerStatus = components["schemas"]["ViewerStatusResponse"];

/** Task entry returned by GET /api/v1/viewer/tasks */
export type ViewerTask = components["schemas"]["ViewerTaskResponse"];
