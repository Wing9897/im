import { describe, expect, it } from "vitest";
import {
  getEvidenceStyleOptions,
  normalizeEvidenceStyle,
} from "./analysisEvidenceStyle";

describe("analysisEvidenceStyle", () => {
  it("exposes three evidence styles without custom", () => {
    expect(getEvidenceStyleOptions().map((o) => o.value)).toEqual([
      "conservative",
      "balanced",
      "aggressive",
    ]);
  });

  it("normalizes invalid or custom values to balanced", () => {
    expect(normalizeEvidenceStyle("balanced")).toBe("balanced");
    expect(normalizeEvidenceStyle("aggressive")).toBe("aggressive");
    expect(normalizeEvidenceStyle("custom")).toBe("balanced");
    expect(normalizeEvidenceStyle("incremental")).toBe("balanced");
    expect(normalizeEvidenceStyle(undefined)).toBe("balanced");
    expect(normalizeEvidenceStyle(null)).toBe("balanced");
  });
});
