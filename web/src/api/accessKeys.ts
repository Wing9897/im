/**
 * Household access keys — LAN / webhook / multi-device (same secret type).
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type AccessKeyPublic = components["schemas"]["AccessKeyPublicResponse"];
export type AccessKeyCreated = components["schemas"]["AccessKeyCreatedResponse"];
export type AccessKeyList = components["schemas"]["AccessKeyListResponse"];

export function fetchAccessKeys(): Promise<AccessKeyList> {
  return apiClient.get<AccessKeyList>("/api/v1/access-keys");
}

export function createAccessKey(label: string): Promise<AccessKeyCreated> {
  return apiClient.post<AccessKeyCreated>("/api/v1/access-keys", { label });
}

export function revokeAccessKey(keyId: string): Promise<components["schemas"]["AccessKeyDeleteResponse"]> {
  return apiClient.delete<components["schemas"]["AccessKeyDeleteResponse"]>(
    `/api/v1/access-keys/${encodeURIComponent(keyId)}`,
  );
}
