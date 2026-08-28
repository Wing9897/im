/**
 * Shared avatar label + image resolution for local IM profile and calendar-share handle.
 * Falls back to initials from handle when no data URL is stored.
 */

export function identityInitials(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const second = parts[1];
    if (first && second) {
      return `${first.charAt(0)}${second.charAt(0)}`.toUpperCase();
    }
  }
  return trimmed.slice(0, 2).toUpperCase();
}

export type ResolvedIdentityAvatar = {
  label: string;
  imageSrc: string | null;
  initials: string;
};

/** Prefer a stored data URL; otherwise derive initials from the display label. */
export function resolveIdentityAvatar(
  label: string,
  avatarDataUrl?: string | null,
): ResolvedIdentityAvatar {
  const imageSrc = avatarDataUrl?.trim() || null;
  const resolvedLabel = label.trim() || "?";
  return {
    label: resolvedLabel,
    imageSrc,
    initials: identityInitials(resolvedLabel),
  };
}
