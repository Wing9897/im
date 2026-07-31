import { describe, expect, it, vi } from "vitest";

import { formatAppVersion, formatAppVersionLabel } from "./appVersion";

describe("appVersion", () => {
  it("formats semver with v prefix", () => {
    expect(formatAppVersion()).toBe(`v${__APP_VERSION__}`);
  });

  it("includes DEV prefix in development", () => {
    vi.stubEnv("DEV", true);
    expect(formatAppVersionLabel()).toBe(`DEV · v${__APP_VERSION__}`);
  });

  it("omits DEV prefix in production", () => {
    vi.stubEnv("DEV", false);
    expect(formatAppVersionLabel()).toBe(`v${__APP_VERSION__}`);
  });
});
