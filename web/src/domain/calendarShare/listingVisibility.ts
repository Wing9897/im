/** Listing (directory) visibility vs grant/projection visibility. */

export const LISTING_VISIBILITY = ["private_group", "public", "public_busy"] as const;
export type CalendarShareListingVisibility = (typeof LISTING_VISIBILITY)[number];

export const GRANT_VISIBILITY = ["busy", "details"] as const;
export type CalendarShareGrantVisibility = (typeof GRANT_VISIBILITY)[number];

export const SEARCH_HIT_KIND = ["listing", "grant"] as const;
export type CalendarShareSearchHitKind = (typeof SEARCH_HIT_KIND)[number];

/** Search mixes public listings with grant-only hits. */
export const SEARCH_HIT_VISIBILITY = ["public", "public_busy", "busy", "details"] as const;
export type CalendarShareSearchHitVisibility = (typeof SEARCH_HIT_VISIBILITY)[number];

export type CalendarShareSearchHitFields = {
  hitKind: CalendarShareSearchHitKind;
  publicVisibility?: CalendarShareListingVisibility | null;
  visibility?: CalendarShareGrantVisibility | null;
};

export function isListingVisibility(value: string): value is CalendarShareListingVisibility {
  return (LISTING_VISIBILITY as readonly string[]).includes(value);
}

export function isGrantVisibility(value: string): value is CalendarShareGrantVisibility {
  return value === "busy" || value === "details";
}

export function canonicalizeListingVisibility(
  value: string | null | undefined,
): CalendarShareListingVisibility {
  const text = (value ?? "").trim();
  if (isListingVisibility(text)) return text;
  return "private_group";
}

export function isPublicListing(visibility: CalendarShareListingVisibility): boolean {
  return visibility === "public" || visibility === "public_busy";
}

export function isSearchGrantHit(hit: { hitKind?: string | null }): boolean {
  return hit.hitKind === "grant";
}

export function searchHitToneKey(hit: {
  hitKind?: string | null;
  publicVisibility?: string | null;
  visibility?: string | null;
}): CalendarShareListingVisibility | CalendarShareGrantVisibility {
  if (hit.hitKind === "grant") {
    const grant = hit.visibility ?? "";
    return isGrantVisibility(grant) ? grant : "details";
  }
  const listing = hit.publicVisibility ?? "";
  return isListingVisibility(listing) ? listing : "public";
}
