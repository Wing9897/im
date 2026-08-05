// ============================================================
// Channel Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

/** A channel within a messaging platform.
 * Uses composite key (platform, platformId). The `id` field is a synthetic
 * string "platform:platformId" for frontend component compatibility.
 */
export type Channel = components["schemas"]["ChannelResponse"];

/** A channel with its associated account info */
export type ChannelWithSource =
  components["schemas"]["ChannelWithSourceResponse"];
