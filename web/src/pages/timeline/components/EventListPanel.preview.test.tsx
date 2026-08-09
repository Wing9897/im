import { describe, expect, it } from "vitest";
import { previewEventBody } from "./EventListPanel";

describe("previewEventBody", () => {
  it("collapses multiline whitespace for list preview", () => {
    expect(previewEventBody("line1\n\nline2   line3")).toBe("line1 line2 line3");
  });
});
