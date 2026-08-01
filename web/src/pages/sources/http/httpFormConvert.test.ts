/**
 * Unit tests for validateHttpSourceForm (kept outside the layout suite).
 */
import { describe, expect, it } from "vitest";

import { validateHttpSourceForm } from "./httpFormConvert";
import { INITIAL_HTTP_FORM } from "./httpFormTypes";

describe("validateHttpSourceForm", () => {
  it("requires URL", () => {
    expect(validateHttpSourceForm(INITIAL_HTTP_FORM)).toBe("請輸入 URL");
  });

  it("requires http(s) scheme", () => {
    expect(
      validateHttpSourceForm({ ...INITIAL_HTTP_FORM, url: "ftp://example.com" }),
    ).toContain("http://");
  });

  it("accepts a valid GET form", () => {
    expect(
      validateHttpSourceForm({ ...INITIAL_HTTP_FORM, url: "https://example.com/api" }),
    ).toBeNull();
  });
});
