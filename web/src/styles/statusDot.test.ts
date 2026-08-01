/**
 * Unit tests for src/styles/statusDot.ts
 *
 * Tests all exported values: statusDotStyle and statusLabels / formatStatusLabel.
 */
import { beforeAll, describe, it, expect } from "vitest";
import { formatStatusLabel, statusDotStyle, statusLabels } from "./statusDot";
import type { ConnectionStatus } from "../types";
import i18n from "../i18n";
import { setAppLocale } from "../i18n/locale";

beforeAll(() => {
  setAppLocale("zh-Hant");
  void i18n.changeLanguage("zh-Hant");
});

// --- statusDotStyle ---

describe("statusDotStyle", () => {
  it("returns green (success) background for 'connected' status", () => {
    const style = statusDotStyle("connected");
    expect(style.background).toBe("var(--success)");
  });

  it("returns red (error) background for 'error' status", () => {
    const style = statusDotStyle("error");
    expect(style.background).toBe("var(--error)");
  });

  it("returns muted background for 'disconnected' status", () => {
    const style = statusDotStyle("disconnected");
    expect(style.background).toBe("var(--text-muted)");
  });

  it("returns consistent dot shape properties for all statuses", () => {
    const statuses: ConnectionStatus[] = ["connected", "disconnected", "error"];

    for (const status of statuses) {
      const style = statusDotStyle(status);
      expect(style.display).toBe("inline-block");
      expect(style.width).toBe(8);
      expect(style.height).toBe(8);
      expect(style.borderRadius).toBe("50%");
      expect(style.marginRight).toBe(6);
    }
  });

  it("returns muted background for unknown status values", () => {
    // Cast to ConnectionStatus to simulate unexpected runtime values
    const style = statusDotStyle("unknown" as ConnectionStatus);
    expect(style.background).toBe("var(--text-muted)");
  });

  it("returns muted background for empty string status", () => {
    const style = statusDotStyle("" as ConnectionStatus);
    expect(style.background).toBe("var(--text-muted)");
  });
});

// --- statusLabels / formatStatusLabel ---

describe("statusLabels", () => {
  it("maps 'connected' to Traditional Chinese label", () => {
    expect(statusLabels.connected).toBe("已連線");
    expect(formatStatusLabel("connected")).toBe("已連線");
  });

  it("maps transient 'connecting' status", () => {
    expect(statusLabels.connecting).toBe("連線中…");
    expect(formatStatusLabel("connecting")).toBe("連線中…");
  });

  it("maps 'disconnected' to Traditional Chinese label", () => {
    expect(statusLabels.disconnected).toBe("已斷線");
    expect(formatStatusLabel("disconnected")).toBe("已斷線");
  });

  it("maps 'error' to Traditional Chinese label", () => {
    expect(statusLabels.error).toBe("錯誤");
    expect(formatStatusLabel("error")).toBe("錯誤");
  });

  it("falls back unknown status to disconnected", () => {
    expect(formatStatusLabel("unknown")).toBe("已斷線");
    expect(formatStatusLabel(null)).toBe("已斷線");
  });

  it("contains every connection status entry", () => {
    const keys = Object.keys(statusLabels);
    expect(keys.sort()).toEqual(["connected", "connecting", "disconnected", "error"]);
  });

  it("all labels are non-empty strings", () => {
    for (const label of Object.values(statusLabels)) {
      expect(label).toBeTruthy();
      expect(typeof label).toBe("string");
      expect(label.trim().length).toBeGreaterThan(0);
    }
  });
});
