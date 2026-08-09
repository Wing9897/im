import { describe, expect, it } from "vitest";

import { ensureOptionInList } from "./ensureSelectOption";

describe("ensureOptionInList", () => {
  it("returns the original list when the id is already present", () => {
    const rows = [{ id: "a" }, { id: "b" }];
    expect(ensureOptionInList(rows, "b", (id) => ({ id }))).toEqual(rows);
  });

  it("appends a synthetic row when the selected id is missing", () => {
    const rows = [{ id: "a" }];
    expect(ensureOptionInList(rows, "orphan", (id) => ({ id, name: id }))).toEqual([
      { id: "a" },
      { id: "orphan", name: "orphan" },
    ]);
  });

  it("ignores blank ids", () => {
    const rows = [{ id: "a" }];
    expect(ensureOptionInList(rows, "  ", (id) => ({ id }))).toEqual(rows);
  });
});
