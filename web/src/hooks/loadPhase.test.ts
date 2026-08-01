import { describe, expect, it } from "vitest";
import { loadPhase } from "./loadPhase";

describe("loadPhase", () => {
  it("marks initial load when fetching with no cached data", () => {
    expect(loadPhase(true, false)).toEqual({
      initialLoading: true,
      isRefreshing: false,
    });
  });

  it("marks refresh when fetching with cached data", () => {
    expect(loadPhase(true, true)).toEqual({
      initialLoading: false,
      isRefreshing: true,
    });
  });

  it("is idle when not fetching", () => {
    expect(loadPhase(false, true)).toEqual({
      initialLoading: false,
      isRefreshing: false,
    });
  });
});
