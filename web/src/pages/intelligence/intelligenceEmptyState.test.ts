import { describe, expect, it } from "vitest";
import { ensureZhHantLocale } from "../../test/i18nHarness";
import { getIntelligenceEmptyCopy } from "./intelligenceEmptyState";

describe("getIntelligenceEmptyCopy", () => {
  it("uses source-only empty copy when only the source filter is active", async () => {
    await ensureZhHantLocale();
    const copy = getIntelligenceEmptyCopy({
      intelligenceTasksCount: 2,
      hasActiveFilters: true,
      hasSearchFilter: false,
      hasTimeFilter: false,
      hasSourceFilter: true,
    });
    expect(copy.title).toContain("來源");
    expect(copy.description).toContain("來源");
    expect(copy.showClearFilters).toBe(true);
  });

  it("uses combined empty copy for multiple active filters", async () => {
    await ensureZhHantLocale();
    const copy = getIntelligenceEmptyCopy({
      intelligenceTasksCount: 2,
      hasActiveFilters: true,
      hasSearchFilter: true,
      hasTimeFilter: false,
      hasSourceFilter: true,
    });
    expect(copy.title).toContain("符合條件");
    expect(copy.showClearFilters).toBe(true);
  });
});
