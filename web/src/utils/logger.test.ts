import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("logger", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe("development mode (import.meta.env.DEV = true)", () => {
    it("logWarn calls console.warn", async () => {
      import.meta.env.DEV = true;
      const { logWarn } = await import("./logger");
      logWarn("test warning", 42);
      expect(warnSpy).toHaveBeenCalledWith("test warning", 42);
    });

    it("logError calls console.error", async () => {
      import.meta.env.DEV = true;
      const { logError } = await import("./logger");
      logError("test error", { detail: "info" });
      expect(errorSpy).toHaveBeenCalledWith("test error", { detail: "info" });
    });
  });

  describe("production mode (import.meta.env.DEV = false)", () => {
    it("logWarn does not call console.warn", async () => {
      import.meta.env.DEV = false;
      const { logWarn } = await import("./logger");
      logWarn("should be silent");
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("logError does not call console.error", async () => {
      import.meta.env.DEV = false;
      const { logError } = await import("./logger");
      logError("should be silent");
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
