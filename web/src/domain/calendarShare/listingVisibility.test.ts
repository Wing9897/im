import { describe, expect, it } from "vitest";
import {
  canonicalizeListingVisibility,
  isGrantVisibility,
  isPublicListing,
  isSearchGrantHit,
  searchHitToneKey,
} from "./listingVisibility";

describe("listingVisibility", () => {
  it("accepts canonical listing values and defaults unknown", () => {
    expect(canonicalizeListingVisibility("public")).toBe("public");
    expect(canonicalizeListingVisibility("public_busy")).toBe("public_busy");
    expect(canonicalizeListingVisibility("private_group")).toBe("private_group");
    expect(canonicalizeListingVisibility("off")).toBe("private_group");
    expect(canonicalizeListingVisibility("details")).toBe("private_group");
    expect(canonicalizeListingVisibility("busy")).toBe("private_group");
    expect(canonicalizeListingVisibility("mystery")).toBe("private_group");
  });

  it("keeps grant busy/details distinct from listing public/public_busy", () => {
    expect(isGrantVisibility("busy")).toBe(true);
    expect(isGrantVisibility("details")).toBe(true);
    expect(isGrantVisibility("public_busy")).toBe(false);
    expect(isGrantVisibility("public")).toBe(false);
    expect(isPublicListing("public")).toBe(true);
    expect(isPublicListing("public_busy")).toBe(true);
    expect(isPublicListing("private_group")).toBe(false);
  });

  it("uses hitKind instead of guessing listing vs grant from the visibility union", () => {
    expect(isSearchGrantHit({ hitKind: "grant" })).toBe(true);
    expect(isSearchGrantHit({ hitKind: "listing" })).toBe(false);
    expect(searchHitToneKey({ hitKind: "listing", publicVisibility: "public_busy" })).toBe("public_busy");
    expect(searchHitToneKey({ hitKind: "grant", visibility: "details" })).toBe("details");
    expect(canonicalizeListingVisibility("public")).toBe("public");
  });
});
