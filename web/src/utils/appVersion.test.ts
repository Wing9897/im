import { describe, expect, it, vi } from "vitest";

import { formatAppVersion, formatAppVersionLabel } from "./appVersion";

describe("appVersion", () => {
  it("formats semver with v prefix", () => {
    expect(formatAppVersion()).toBe("v0.1.0-beta.1");
  });

  it("includes DEV prefix in development", () => {
    vi.stubEnv("DEV", true);
    expect(formatAppVersionLabel()).toBe("DEV · v0.1.0-beta.1");
  });

  it("omits DEV prefix in production", () => {
    vi.stubEnv("DEV", false);
    expect(formatAppVersionLabel()).toBe("v0.1.0-beta.1");
  });
});
