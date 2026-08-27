import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  DEFAULT_GENERAL_SLUG,
  PUBLISH_SLUG_MAX_LEN,
  coercePublishSlug,
  defaultPublishSlug,
  isValidPublishSlug,
} from "./publishSlug";

describe("defaultPublishSlug", () => {
  it("uses general for the builtin workset, not the raw id", () => {
    expect(defaultPublishSlug("一般", SYSTEM_WORKSET_ID)).toBe(DEFAULT_GENERAL_SLUG);
    expect(defaultPublishSlug("General", "__general__")).toBe("general");
    expect(DEFAULT_GENERAL_SLUG).toBe("general");
  });

  it("sanitizes other workset ids to start and end alphanumeric", () => {
    expect(defaultPublishSlug("Ops", "ws-1")).toBe("Ops");
    expect(defaultPublishSlug("Team board", "ws-team")).toBe("Team-board");
    expect(defaultPublishSlug("專案", "_my-set_")).toBe("my-set");
    expect(defaultPublishSlug("...", "...")).toBe("calendar");
  });
});

describe("isValidPublishSlug", () => {
  it("accepts write-valid slugs and coerces __general__", () => {
    expect(isValidPublishSlug("general")).toBe(true);
    expect(isValidPublishSlug("A_B")).toBe(true);
    expect(isValidPublishSlug("foo-bar.baz")).toBe(true);
    expect(isValidPublishSlug("__general__")).toBe(true);
  });

  it("rejects empty, spaces, slash, and overlong values", () => {
    expect(isValidPublishSlug("")).toBe(false);
    expect(isValidPublishSlug("   ")).toBe(false);
    expect(isValidPublishSlug("foo bar")).toBe(false);
    expect(isValidPublishSlug("a/b")).toBe(false);
    expect(isValidPublishSlug("a".repeat(PUBLISH_SLUG_MAX_LEN + 1))).toBe(false);
    expect(isValidPublishSlug("_leading")).toBe(false);
  });
});

describe("coercePublishSlug", () => {
  it("maps the builtin workset id only", () => {
    expect(coercePublishSlug("  __general__  ")).toBe("general");
    expect(coercePublishSlug("Work")).toBe("Work");
  });
});
