import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";

const fetchHealth = vi.fn();

vi.mock("../../api/system", () => ({ fetchHealth }));

const { SystemVersionPanel } = await import("./SystemVersionPanel");

describe("SystemVersionPanel", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
    vi.clearAllMocks();
    fetchHealth.mockResolvedValue({
      status: "ok",
      version: "0.1.0-beta.6",
      runtimeReady: true,
      secretsReady: true,
      schemaVersion: 5,
      schemaSemver: "0.1.0-beta.6",
    });
  });

  afterEach(() => harness.cleanup());

  it("shows unified app version and database schema after load", async () => {
    await harness.render(SystemVersionPanel);
    await act(async () => {
      await Promise.resolve();
    });

    const panel = harness.container.querySelector('[data-testid="system-version-panel"]');
    expect(panel?.textContent).toContain("應用版本");
    expect(panel?.textContent).toContain("DEV · v0.1.0-beta.6");
    expect(panel?.textContent).toContain("資料庫 Schema");
    expect(panel?.textContent).toContain("v0.1.0-beta.6");
  });

  it("shows unavailable when schema fetch fails", async () => {
    fetchHealth.mockRejectedValue(new Error("offline"));

    await harness.render(SystemVersionPanel);
    await act(async () => {
      await Promise.resolve();
    });

    expect(harness.container.textContent).toContain("無法取得");
    expect(harness.container.textContent).toContain("DEV · v0.1.0-beta.6");
  });
});
