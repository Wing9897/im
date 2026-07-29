/**
 * Schema upgrade gate API (public; used before runtime is ready).
 */

import type { SchemaUpgradeStatus } from "../types/schema";
import { publicFetchJson } from "./publicFetch";

/** Poll schema / runtime readiness (works even when business APIs return 503). */
export function fetchSchemaStatus(): Promise<SchemaUpgradeStatus> {
  return publicFetchJson<SchemaUpgradeStatus>("/api/v1/system/schema/status");
}

/** Start stop-the-world backup + migration + runtime start. */
export function startSchemaUpgrade(): Promise<SchemaUpgradeStatus> {
  return publicFetchJson<SchemaUpgradeStatus>("/api/v1/system/schema/upgrade", {
    method: "POST",
  });
}
