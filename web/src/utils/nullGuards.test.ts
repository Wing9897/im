/**
 * Unit tests for Null Guard Utilities
 *
 * Feature: api-null-safety-audit, Property 3: Null guard transparency and safety
 *
 * Validates: Requirements 4.1, 4.2, 4.4, 4.5
 */
import { describe, it, expect } from "vitest";
import { safeArray } from "./nullGuards";

describe("safeArray", () => {
  it.each([
    [[]],
    [[1, 2, 3]],
    [["a", "b"]],
    [[{ id: 1 }, { id: 2 }]],
  ])("returns the input array unchanged for %j", (arr) => {
    expect(safeArray(arr)).toBe(arr);
  });

  it.each([null, undefined])("returns an empty array for %s", (input) => {
    const result = safeArray(input);
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it.each([
    [[]],
    [[1, 2, 3]],
    [null],
    [undefined],
  ])("never throws for input %j", (input) => {
    expect(() => safeArray(input)).not.toThrow();
  });
});
