import { useCallback, useEffect, useState } from "react";
import { fetchAccessKeys, type AccessKeyPublic } from "../../../api/accessKeys";
import { resolveBaseUrl } from "../../../api/client";
import { DEFAULT_API_PORT } from "../../../api/serviceEndpoints";
import { toErrorMessage } from "../../../utils/errors";

/** Read-only service port derived from the active API base URL. */
function getWebhookServicePort(): string {
  const fallback = String(DEFAULT_API_PORT);
  try {
    const url = new URL(resolveBaseUrl());
    if (url.port) return url.port;
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Webhook / general API needs a full household key (`*`).
 * Empty scopes are not treated as full — only an explicit `*` grants write access.
 */
export function isFullAccessKey(key: Pick<AccessKeyPublic, "scopes">): boolean {
  const scopes = key.scopes;
  if (scopes == null || scopes.length === 0) return false;
  return scopes.includes("*");
}

export function countFullAccessKeys(keys: AccessKeyPublic[] | null | undefined): number {
  if (!keys?.length) return 0;
  return keys.filter(isFullAccessKey).length;
}

/** Webhook panel: service URL + link to profile for key management. */
export function useWebhookPanel() {
  const [keys, setKeys] = useState<AccessKeyPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const body = await fetchAccessKeys();
      setKeys(body.keys ?? []);
    } catch (e) {
      setError(toErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const keyCount = countFullAccessKeys(keys);
  const isConfigured = keyCount > 0;
  const servicePort = getWebhookServicePort();
  const serviceBaseUrl = resolveBaseUrl();

  return {
    keys,
    keyCount,
    servicePort,
    serviceBaseUrl,
    error,
    isConfigured,
  };
}
