import { describe, expect, it } from "vitest";

import { normalizeWorksetDescription, WORKSET_DESCRIPTION_MAX } from "./worksetFields";

describe("worksetFields", () => {
  it("trims description and keeps the 280 cap as a constant", () => {
    expect(normalizeWorksetDescription("  hello  ")).toBe("hello");
    expect(WORKSET_DESCRIPTION_MAX).toBe(280);
  });
});
