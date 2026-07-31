import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";

const fetchSchemaStatus = vi.fn();

vi.mock("../../api/schema", () => ({ fetchSchemaStatus }));

const { SystemVersionPanel } = await import("./SystemVersionPanel");

describe("SystemVersionPanel", () => {
  let harness: TestHarness;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    harness = createTestHarness();
    vi.clearAllMocks();
    fetchSchemaStatus.mockResolvedValue({
      state: "ready",
      runtimeReady: true,
      schemaVersion: 1,
      requiredSchemaVersion: 1,
      schemaSemver: "0.1.0-beta.4",
      backupPath: null,
      error: null,
      restoredFromBackup: false,
      progress: { phase: "idle", percent: 100, message: "ready" },
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
    expect(panel?.textContent).toContain("DEV · v0.1.0-beta.4");
    expect(panel?.textContent).toContain("資料庫 Schema");
    expect(panel?.textContent).toContain("v0.1.0-beta.4");
  });

  it("shows upgrade hint with SemVer and int stamps when schema is behind", async () => {
    fetchSchemaStatus.mockResolvedValue({
      state: "needs_upgrade",
      runtimeReady: false,
      schemaVersion: 1,
      requiredSchemaVersion: 2,
      schemaSemver: "0.1.0-beta.4",
      backupPath: null,
      error: null,
      restoredFromBackup: false,
      progress: { phase: "idle", percent: 0, message: "needs_upgrade" },
    });

    await harness.render(SystemVersionPanel);
    await act(async () => {
      await Promise.resolve();
    });

    expect(harness.container.textContent).toContain("0.1.0-beta.4");
    expect(harness.container.textContent).toContain("v1");
    expect(harness.container.textContent).toContain("v2");
  });

  it("shows unavailable when schema fetch fails", async () => {
    fetchSchemaStatus.mockRejectedValue(new Error("offline"));

    await harness.render(SystemVersionPanel);
    await act(async () => {
      await Promise.resolve();
    });

    expect(harness.container.textContent).toContain("無法取得");
    expect(harness.container.textContent).toContain("DEV · v0.1.0-beta.4");
  });
});
