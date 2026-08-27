import { SYSTEM_WORKSET_ID } from "../../types/worksets";

export const PUBLISH_SLUG_MAX_LEN = 64;
/** Write rule: must start with alphanumeric, then letters / digits / . _ - */
export const PUBLISH_SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const DEFAULT_GENERAL_SLUG = "general";

function slugCandidate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "").slice(0, PUBLISH_SLUG_MAX_LEN);
}

/** Builtin workset id is not a valid write slug (leading underscore). */
export function coercePublishSlug(raw: string): string {
  const text = raw.trim();
  if (text === SYSTEM_WORKSET_ID) return DEFAULT_GENERAL_SLUG;
  return text;
}

export function isValidPublishSlug(raw: string): boolean {
  const text = coercePublishSlug(raw);
  return text.length >= 1 && text.length <= PUBLISH_SLUG_MAX_LEN && PUBLISH_SLUG_RE.test(text);
}

/** Prefill for a new publish. ``__general__`` / 「一般」 → ``general``. */
export function defaultPublishSlug(worksetTitle: string, worksetId: string): string {
  if (worksetId.trim() === SYSTEM_WORKSET_ID) return DEFAULT_GENERAL_SLUG;
  const fromTitle = slugCandidate(worksetTitle);
  if (fromTitle && PUBLISH_SLUG_RE.test(fromTitle)) return fromTitle;
  const fromId = slugCandidate(worksetId);
  if (fromId && PUBLISH_SLUG_RE.test(fromId)) return fromId;
  return "calendar";
}
