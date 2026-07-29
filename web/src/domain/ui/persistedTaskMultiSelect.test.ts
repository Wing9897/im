import { beforeEach, describe, expect, it } from "vitest";
import {
  loadPersistedTaskMultiSelect,
  savePersistedTaskMultiSelect,
} from "./persistedTaskMultiSelect";

const storageKey = "test:selected-task-ids";

describe("persistedTaskMultiSelect", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("preserves an empty selection when the domain treats [] as none", () => {
    localStorage.setItem(storageKey, "[]");
    expect(
      loadPersistedTaskMultiSelect({
        storageKey,
        emptyArray: "preserve",
      }),
    ).toEqual([]);
  });

  it("normalizes an empty selection when the domain treats [] as all", () => {
    localStorage.setItem(storageKey, "[]");
    expect(
      loadPersistedTaskMultiSelect({
        storageKey,
        emptyArray: "normalize-to-all",
      }),
    ).toBeNull();
  });

  it("round-trips ids on load and save", () => {
    const options = {
      storageKey,
      emptyArray: "preserve" as const,
    };
    savePersistedTaskMultiSelect(options, ["a", "b"]);
    expect(loadPersistedTaskMultiSelect(options)).toEqual(["a", "b"]);
  });

  it("rejects malformed persisted values", () => {
    localStorage.setItem(storageKey, JSON.stringify(["a", 1]));
    expect(
      loadPersistedTaskMultiSelect({
        storageKey,
        emptyArray: "preserve",
      }),
    ).toBeNull();
  });
});
