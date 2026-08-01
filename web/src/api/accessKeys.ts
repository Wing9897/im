/**
 * Household access keys — LAN / webhook / multi-device (same secret type).
 */

import { apiClient } from "./client";

export type AccessKeyPublic = {
  id: string;
  label: string;
  preview: string;
  createdAt: string;
  scopes: string[];
  lastUsedAt?: string | null;
};

export type AccessKeyCreated = AccessKeyPublic & {
  /** Full secret — shown once after create. */
  key: string;
};

export type CreateAccessKeyOptions = {
  /** When true, create a read-only key (`["read"]`). Default full `["*"]`. */
  readOnly?: boolean;
};

export function fetchAccessKeys(): Promise<{ keys: AccessKeyPublic[] }> {
  return apiClient.get<{ keys: AccessKeyPublic[] }>("/api/v1/access-keys");
}

export function createAccessKey(
  label: string,
  options: CreateAccessKeyOptions = {},
): Promise<AccessKeyCreated> {
  return apiClient.post<AccessKeyCreated>("/api/v1/access-keys", {
    label,
    readOnly: Boolean(options.readOnly),
  });
}

export function revokeAccessKey(keyId: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/api/v1/access-keys/${encodeURIComponent(keyId)}`);
}
