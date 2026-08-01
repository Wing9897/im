import { useCallback, useEffect, useState } from "react";
import { fetchSystemSettings, saveSystemSettings } from "../../api/config";

/**
 * Assistant display name + avatar.
 * Source of truth: SQLite ``system_config`` via settings API.
 * ``localStorage`` is a sync/offline cache only (not a migrate source).
 */
export const ASSISTANT_IDENTITY_KEY = "im:ai-staff:assistant:v1";
export const ASSISTANT_IDENTITY_EVENT = "im:ai-staff:assistant:v1-change";

export const AVATAR_MAX_EDGE_PX = 256;
/** Cap on data-URL string length (~200KB). */
export const AVATAR_MAX_DATA_URL_CHARS = 200 * 1024;
export const DISPLAY_NAME_MAX_CHARS = 64;

export type AssistantIdentity = {
  displayName: string;
  avatarDataUrl: string | null;
};

export const DEFAULT_ASSISTANT_IDENTITY: AssistantIdentity = {
  displayName: "",
  avatarDataUrl: null,
};

function isIdentity(value: unknown): value is AssistantIdentity {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const nameOk = typeof record.displayName === "string";
  const avatarOk =
    record.avatarDataUrl === null || typeof record.avatarDataUrl === "string";
  return nameOk && avatarOk;
}

export function identityFromSettings(fields: {
  assistantDisplayName?: string;
  assistantAvatar?: string;
}): AssistantIdentity {
  const avatar = (fields.assistantAvatar ?? "").trim();
  return {
    displayName: (fields.assistantDisplayName ?? "").trim().slice(0, DISPLAY_NAME_MAX_CHARS),
    avatarDataUrl: avatar || null,
  };
}

export function identityToSettingsPatch(identity: AssistantIdentity): {
  assistantDisplayName: string;
  assistantAvatar: string;
} {
  return {
    assistantDisplayName: identity.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
    assistantAvatar: identity.avatarDataUrl?.trim() || "",
  };
}

/** Read local cache (legacy + optimistic UI). */
export function readAssistantIdentity(): AssistantIdentity {
  try {
    const raw = window.localStorage.getItem(ASSISTANT_IDENTITY_KEY);
    if (!raw) return { ...DEFAULT_ASSISTANT_IDENTITY };
    const parsed: unknown = JSON.parse(raw);
    if (!isIdentity(parsed)) return { ...DEFAULT_ASSISTANT_IDENTITY };
    return {
      displayName: parsed.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
      avatarDataUrl: parsed.avatarDataUrl,
    };
  } catch {
    return { ...DEFAULT_ASSISTANT_IDENTITY };
  }
}

export function writeAssistantIdentity(value: AssistantIdentity): void {
  try {
    window.localStorage.setItem(
      ASSISTANT_IDENTITY_KEY,
      JSON.stringify({
        displayName: value.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
        avatarDataUrl: value.avatarDataUrl,
      }),
    );
    window.dispatchEvent(new Event(ASSISTANT_IDENTITY_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Blank display name falls back to the i18n default label. */
export function resolveAssistantDisplayName(
  identity: AssistantIdentity,
  fallback: string,
): string {
  const trimmed = identity.displayName.trim();
  return trimmed || fallback;
}

/**
 * Resize to ≤`maxEdge` on the long side and encode as JPEG data URL under
 * `maxDataUrlChars`. Throws `"too_large"` / `"read_failed"` string codes.
 */
export async function compressAvatarToDataUrl(
  file: File,
  options?: { maxEdge?: number; maxDataUrlChars?: number },
): Promise<string> {
  const maxEdge = options?.maxEdge ?? AVATAR_MAX_EDGE_PX;
  const maxDataUrlChars = options?.maxDataUrlChars ?? AVATAR_MAX_DATA_URL_CHARS;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("read_failed");
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("read_failed");
    ctx.drawImage(bitmap, 0, 0, width, height);

    for (const quality of [0.85, 0.7, 0.55, 0.4, 0.28] as const) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= maxDataUrlChars) return dataUrl;
    }
    throw new Error("too_large");
  } finally {
    bitmap.close();
  }
}

let hydratePromise: Promise<AssistantIdentity> | null = null;

/**
 * Load identity from settings. Empty server → defaults (no localStorage migrate).
 * Refreshes the local cache from the server snapshot after a successful read.
 */
export async function hydrateAssistantIdentityFromServer(): Promise<AssistantIdentity> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const snapshot = await fetchSystemSettings();
        const identity = identityFromSettings(snapshot);
        writeAssistantIdentity(identity);
        return identity;
      } catch {
        return readAssistantIdentity();
      }
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

async function persistIdentity(next: AssistantIdentity): Promise<AssistantIdentity> {
  const normalized: AssistantIdentity = {
    displayName: next.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
    avatarDataUrl: next.avatarDataUrl,
  };
  writeAssistantIdentity(normalized);
  try {
    const saved = await saveSystemSettings(identityToSettingsPatch(normalized));
    const fromServer = identityFromSettings(saved);
    writeAssistantIdentity(fromServer);
    return fromServer;
  } catch {
    return normalized;
  }
}

/** Server-backed assistant identity with localStorage cache (no LS→server migrate). */
export function useAssistantIdentity() {
  const [identity, setIdentityState] = useState<AssistantIdentity>(() => readAssistantIdentity());

  useEffect(() => {
    let cancelled = false;
    const onExternal = () => {
      if (!cancelled) setIdentityState(readAssistantIdentity());
    };
    window.addEventListener(ASSISTANT_IDENTITY_EVENT, onExternal);
    void hydrateAssistantIdentityFromServer().then((loaded) => {
      if (!cancelled) setIdentityState(loaded);
    });
    return () => {
      cancelled = true;
      window.removeEventListener(ASSISTANT_IDENTITY_EVENT, onExternal);
    };
  }, []);

  const setIdentity = useCallback((value: AssistantIdentity | ((prev: AssistantIdentity) => AssistantIdentity)) => {
    setIdentityState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      void persistIdentity(next);
      return {
        displayName: next.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
        avatarDataUrl: next.avatarDataUrl,
      };
    });
  }, []);

  const setDisplayName = useCallback(
    (displayName: string) => {
      setIdentity((prev) => ({ ...prev, displayName }));
    },
    [setIdentity],
  );

  const setAvatarDataUrl = useCallback(
    (avatarDataUrl: string | null) => {
      setIdentity((prev) => ({ ...prev, avatarDataUrl }));
    },
    [setIdentity],
  );

  const resetAvatar = useCallback(() => {
    setIdentity((prev) => ({ ...prev, avatarDataUrl: null }));
  }, [setIdentity]);

  const resetIdentity = useCallback(() => {
    setIdentity({ ...DEFAULT_ASSISTANT_IDENTITY });
  }, [setIdentity]);

  return {
    identity,
    setIdentity,
    setDisplayName,
    setAvatarDataUrl,
    resetAvatar,
    resetIdentity,
  } as const;
}
