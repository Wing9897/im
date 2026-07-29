/** Schema upgrade gate wire types. */

import type { components } from "../api/generated/schema";

export type SchemaUpgradeProgress = components["schemas"]["SchemaUpgradeProgress"];

/** Narrow `state` for UI branches; remaining fields alias the OpenAPI response. */
export type SchemaUpgradeStatus = Omit<
  components["schemas"]["SchemaUpgradeStatusResponse"],
  "state"
> & {
  state: "ready" | "needs_upgrade" | "migrating" | "failed";
};
