import { describe, expect, it } from "vitest";

import { computeImageFlexShare, pickWallLayout } from "./wallLayout";

describe("pickWallLayout", () => {
  it("returns text-only without visual media", () => {
    expect(
      pickWallLayout({
        hasVisualMedia: false,
        hasText: true,
        textLength: 40,
        aspectRatio: 1.5,
      }),
    ).toBe("text-only");
  });

  it("returns image-only without caption text", () => {
    expect(
      pickWallLayout({
        hasVisualMedia: true,
        hasText: false,
        textLength: 0,
        aspectRatio: 1.2,
      }),
    ).toBe("image-only");
  });

  it("falls back to stack before aspect ratio is known", () => {
    expect(
      pickWallLayout({
        hasVisualMedia: true,
        hasText: true,
        textLength: 20,
        aspectRatio: null,
      }),
    ).toBe("stack");
  });

  it("uses stack for wide images so the preview can span the card width", () => {
    expect(
      pickWallLayout({
        hasVisualMedia: true,
        hasText: true,
        textLength: 120,
        aspectRatio: 1.6,
      }),
    ).toBe("stack");
  });

  it("uses stack for tall images so portrait cards stay vertical", () => {
    expect(
      pickWallLayout({
        hasVisualMedia: true,
        hasText: true,
        textLength: 90,
        aspectRatio: 0.6,
      }),
    ).toBe("stack");
  });

  it("uses stack for very long text on tall images", () => {
    expect(
      pickWallLayout({
        hasVisualMedia: true,
        hasText: true,
        textLength: 220,
        aspectRatio: 0.6,
      }),
    ).toBe("stack");
  });
});

describe("computeImageFlexShare", () => {
  it("allocates more vertical space to landscape previews", () => {
    const landscape = computeImageFlexShare(80, 1.6, "stack");
    const square = computeImageFlexShare(80, 1.0, "stack");
    expect(landscape).toBeGreaterThan(square);
  });

  it("keeps image-only slides maximized", () => {
    expect(computeImageFlexShare(0, 1.2, "image-only")).toBe(100);
  });
});
