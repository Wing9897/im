// ============================================================
// Workset Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** Optional ownership dimension — wire shape is OpenAPI `WorksetResponse`. */
export type Workset = components["schemas"]["WorksetResponse"];

/** Builtin system workset for handwritten / assistant ownership. */
export const SYSTEM_WORKSET_ID = "__user__";
