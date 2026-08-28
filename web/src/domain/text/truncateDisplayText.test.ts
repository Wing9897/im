import { describe, expect, it } from "vitest";

import { truncateDisplayText } from "./truncateDisplayText";

describe("truncateDisplayText", () => {
  it("returns trimmed text when within limit", () => {
    expect(truncateDisplayText("  hello  ", 10)).toBe("hello");
  });

  it("truncates with ellipsis", () => {
    expect(truncateDisplayText("abcdefghij", 6)).toBe("abcde…");
  });
});
