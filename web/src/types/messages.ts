// ============================================================
// Message Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";
import type { MessageTimeRange } from "./common";

/** Media metadata attached to a message (blob fetched on demand). */
export type MessageMedia = components["schemas"]["MessageMediaResponse"];

/** A collected message from a platform channel */
export type Message = components["schemas"]["MessageResponse"];

/** Filters for querying messages */
export interface MessageFilters {
  sourceIds?: string[];
  /** Synthetic channel ids ("platform:platformId"). */
  channelIds?: string[];
  timeRange?: MessageTimeRange;
  search?: string;
  platform?: string;
}

export type MessageCursor = components["schemas"]["MessageCursorResponse"];

export type MessagePage = components["schemas"]["MessagesPageResponse"];
