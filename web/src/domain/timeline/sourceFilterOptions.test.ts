import { describe, expect, it } from "vitest";

import {
  catalogOrEventSourceOptions,
  resolveSourceFilterTaskLabel,
} from "./sourceFilterOptions";

describe("resolveSourceFilterTaskLabel", () => {
  it("prefers a trimmed task title", () => {
    expect(resolveSourceFilterTaskLabel("  Weekly sync  ", "abc", "Unnamed task")).toBe(
      "Weekly sync",
    );
  });

  it("never uses a full hex id as the primary label", () => {
    const hex = "2049aa3c7fa64c01b19c45ad336cc7be";
    expect(resolveSourceFilterTaskLabel("", hex, "Unnamed task")).toBe(
      "Unnamed task (2049aa3c…)",
    );
    expect(resolveSourceFilterTaskLabel(null, hex, "未命名任務")).toBe(
      "未命名任務 (2049aa3c…)",
    );
  });

  it("uses unnamed fallback for short opaque-less ids without a title", () => {
    expect(resolveSourceFilterTaskLabel("  ", "task-3", "Unnamed task")).toBe(
      "Unnamed task",
    );
  });
});

describe("catalogOrEventSourceOptions", () => {
  it("maps empty catalog names through the readable fallback", () => {
    const hex = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(catalogOrEventSourceOptions([{ id: hex, name: "" }], [])).toEqual([
      { id: hex, name: expect.stringContaining("aaaaaaaa") },
    ]);
    expect(catalogOrEventSourceOptions([{ id: hex, name: "" }], [])[0].name).not.toBe(hex);
  });
});
