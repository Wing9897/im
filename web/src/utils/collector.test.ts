import { describe, expect, it } from "vitest";

import {
  isWireAdapterCollectorEvent,
  isAggregateCollectorStatus,
  shouldRefetchCollectorStatus,
  normalizeCollectorStatus,
} from "./collector";

describe("collector utils", () => {
  describe("normalizeCollectorStatus", () => {
    it("returns a valid CollectorStatus for known values", () => {
      expect(normalizeCollectorStatus("running")).toBe("running");
      expect(normalizeCollectorStatus("stopped")).toBe("stopped");
      expect(normalizeCollectorStatus("error")).toBe("error");
    });

    it("falls back for transition tokens the server never reports", () => {
      expect(normalizeCollectorStatus("starting")).toBe("stopped");
      expect(normalizeCollectorStatus("stopping")).toBe("stopped");
      expect(normalizeCollectorStatus("restarting")).toBe("stopped");
    });

    it("trims and lowercases the input", () => {
      expect(normalizeCollectorStatus("  Running  ")).toBe("running");
      expect(normalizeCollectorStatus("STOPPED")).toBe("stopped");
    });

    it('returns the default fallback "stopped" for unknown values', () => {
      expect(normalizeCollectorStatus("unknown")).toBe("stopped");
      expect(normalizeCollectorStatus("")).toBe("stopped");
      expect(normalizeCollectorStatus("garbage")).toBe("stopped");
    });

    it("returns a custom fallback when provided", () => {
      expect(normalizeCollectorStatus("unknown", "error")).toBe("error");
    });
  });

  describe("isWireAdapterCollectorEvent", () => {
    it("detects per-adapter SSE wire tokens", () => {
      expect(isWireAdapterCollectorEvent("connected")).toBe(true);
      expect(isWireAdapterCollectorEvent("disconnected")).toBe(true);
      expect(isWireAdapterCollectorEvent("connecting")).toBe(true);
      expect(isWireAdapterCollectorEvent("running")).toBe(false);
      expect(isWireAdapterCollectorEvent("stopped")).toBe(false);
    });
  });

  describe("isAggregateCollectorStatus", () => {
    it("detects aggregate collector statuses", () => {
      expect(isAggregateCollectorStatus("running")).toBe(true);
      expect(isAggregateCollectorStatus("connected")).toBe(false);
    });
  });

  describe("shouldRefetchCollectorStatus", () => {
    it("refetches for adapter wire tokens and non-aggregate adapter events", () => {
      expect(shouldRefetchCollectorStatus({ status: "connected" })).toBe(true);
      expect(shouldRefetchCollectorStatus({ status: "running" })).toBe(false);
      expect(
        shouldRefetchCollectorStatus({
          status: "connected",
          adapterName: "telegram",
        }),
      ).toBe(true);
      expect(
        shouldRefetchCollectorStatus({
          status: "error",
          adapterName: "telegram",
          errorSummary: "fail",
        }),
      ).toBe(false);
    });
  });
});
