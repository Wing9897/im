import { useCallback, useEffect, useState } from "react";
import { fetchSystemSettings, saveSystemSettings } from "../../api/config";
import {
  AVATAR_MAX_DATA_URL_CHARS,
  AVATAR_MAX_EDGE_PX,
  DISPLAY_NAME_MAX_CHARS,
  compressAvatarToDataUrl,
} from "../aiStaff/assistantIdentity";

/**
 * User display name + avatar + background bio.
 * Source of truth: SQLite ``system_config`` via settings API.
 * ``localStorage`` is a sync/offline cache only (not a migrate source).
 */
export const USER_PROFILE_KEY = "im:user:profile:v1";
export const USER_PROFILE_EVENT = "im:user:profile:v1-change";
/** sessionStorage: unsaved profile editor fields (not the committed SoT key above). */
export const USER_PROFILE_DRAFT_KEY = "im:user:profile:draft:v1";

export { AVATAR_MAX_DATA_URL_CHARS, AVATAR_MAX_EDGE_PX, DISPLAY_NAME_MAX_CHARS, compressAvatarToDataUrl };

export const BACKGROUND_MAX_CHARS = 2000;

export type UserProfile = {
  displayName: string;
  avatarDataUrl: string | null;
  background: string;
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  displayName: "",
  avatarDataUrl: null,
  background: "",
};

function isProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const nameOk = typeof record.displayName === "string";
  const avatarOk =
    record.avatarDataUrl === null || typeof record.avatarDataUrl === "string";
  const backgroundOk = typeof record.background === "string";
  return nameOk && avatarOk && backgroundOk;
}

export function profileFromSettings(fields: {
  userDisplayName?: string;
  userAvatar?: string;
  userBackground?: string;
}): UserProfile {
  const avatar = (fields.userAvatar ?? "").trim();
  return {
    displayName: (fields.userDisplayName ?? "").trim().slice(0, DISPLAY_NAME_MAX_CHARS),
    avatarDataUrl: avatar || null,
    background: (fields.userBackground ?? "").slice(0, BACKGROUND_MAX_CHARS),
  };
}

export function profilesEqual(a: UserProfile, b: UserProfile): boolean {
  return (
    a.displayName === b.displayName &&
    a.avatarDataUrl === b.avatarDataUrl &&
    a.background === b.background
  );
}

export function profileToSettingsPatch(profile: UserProfile): {
  userDisplayName: string;
  userAvatar: string;
  userBackground: string;
} {
  return {
    userDisplayName: profile.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
    userAvatar: profile.avatarDataUrl?.trim() || "",
    userBackground: profile.background.slice(0, BACKGROUND_MAX_CHARS),
  };
}

/** Read local cache (legacy + optimistic UI). */
export function readUserProfile(): UserProfile {
  try {
    const raw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_USER_PROFILE };
    const parsed: unknown = JSON.parse(raw);
    if (!isProfile(parsed)) return { ...DEFAULT_USER_PROFILE };
    return {
      displayName: parsed.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
      avatarDataUrl: parsed.avatarDataUrl,
      background: parsed.background.slice(0, BACKGROUND_MAX_CHARS),
    };
  } catch {
    return { ...DEFAULT_USER_PROFILE };
  }
}

export function writeUserProfile(value: UserProfile): void {
  try {
    window.localStorage.setItem(
      USER_PROFILE_KEY,
      JSON.stringify({
        displayName: value.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
        avatarDataUrl: value.avatarDataUrl,
        background: value.background.slice(0, BACKGROUND_MAX_CHARS),
      }),
    );
    window.dispatchEvent(new Event(USER_PROFILE_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Blank display name falls back to the i18n default label. */
export function resolveUserDisplayName(profile: UserProfile, fallback: string): string {
  const trimmed = profile.displayName.trim();
  return trimmed || fallback;
}

let hydratePromise: Promise<UserProfile> | null = null;

/**
 * Load profile from settings. Empty server → defaults (no localStorage migrate).
 * Refreshes the local cache from the server snapshot after a successful read.
 */
export async function hydrateUserProfileFromServer(): Promise<UserProfile> {
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const snapshot = await fetchSystemSettings();
        const profile = profileFromSettings(snapshot);
        writeUserProfile(profile);
        return profile;
      } catch {
        return readUserProfile();
      }
    })().finally(() => {
      hydratePromise = null;
    });
  }
  return hydratePromise;
}

async function persistProfile(next: UserProfile): Promise<UserProfile> {
  const normalized: UserProfile = {
    displayName: next.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
    avatarDataUrl: next.avatarDataUrl,
    background: next.background.slice(0, BACKGROUND_MAX_CHARS),
  };
  writeUserProfile(normalized);
  try {
    const saved = await saveSystemSettings(profileToSettingsPatch(normalized));
    const fromServer = profileFromSettings(saved);
    writeUserProfile(fromServer);
    return fromServer;
  } catch {
    return normalized;
  }
}

/** Server-backed user profile with localStorage cache (no LS→server migrate). */
export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile>(() => readUserProfile());

  useEffect(() => {
    let cancelled = false;
    const onExternal = () => {
      if (!cancelled) setProfileState(readUserProfile());
    };
    window.addEventListener(USER_PROFILE_EVENT, onExternal);
    void hydrateUserProfileFromServer().then((loaded) => {
      if (!cancelled) setProfileState(loaded);
    });
    return () => {
      cancelled = true;
      window.removeEventListener(USER_PROFILE_EVENT, onExternal);
    };
  }, []);

  const setProfile = useCallback((value: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    setProfileState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      void persistProfile(next);
      return {
        displayName: next.displayName.trim().slice(0, DISPLAY_NAME_MAX_CHARS),
        avatarDataUrl: next.avatarDataUrl,
        background: next.background.slice(0, BACKGROUND_MAX_CHARS),
      };
    });
  }, []);

  const setDisplayName = useCallback(
    (displayName: string) => {
      setProfile((prev) => ({ ...prev, displayName }));
    },
    [setProfile],
  );

  const setAvatarDataUrl = useCallback(
    (avatarDataUrl: string | null) => {
      setProfile((prev) => ({ ...prev, avatarDataUrl }));
    },
    [setProfile],
  );

  const setBackground = useCallback(
    (background: string) => {
      setProfile((prev) => ({ ...prev, background }));
    },
    [setProfile],
  );

  const resetAvatar = useCallback(() => {
    setProfile((prev) => ({ ...prev, avatarDataUrl: null }));
  }, [setProfile]);

  const resetProfile = useCallback(() => {
    setProfile({ ...DEFAULT_USER_PROFILE });
  }, [setProfile]);

  return {
    profile,
    setProfile,
    setDisplayName,
    setAvatarDataUrl,
    setBackground,
    resetAvatar,
    resetProfile,
  } as const;
}
