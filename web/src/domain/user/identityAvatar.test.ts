import { describe, expect, it } from "vitest";

import { identityInitials, resolveIdentityAvatar } from "./identityAvatar";

describe("identityAvatar", () => {
  it("derives one- and two-token initials", () => {
    expect(identityInitials("Wing")).toBe("WI");
    expect(identityInitials("Ada Lovelace")).toBe("AL");
    expect(identityInitials("")).toBe("?");
  });

  it("prefers image src when provided", () => {
    const resolved = resolveIdentityAvatar("Wing", "data:image/png;base64,abc");
    expect(resolved.imageSrc).toBe("data:image/png;base64,abc");
    expect(resolved.initials).toBe("WI");
  });

  it("falls back to initials when no image", () => {
    const resolved = resolveIdentityAvatar("DemoPub", null);
    expect(resolved.imageSrc).toBeNull();
    expect(resolved.initials).toBe("DE");
  });
});
