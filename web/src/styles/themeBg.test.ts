import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  THEME_FOCAL_CACHE_KEY,
  THEME_FOCAL_REFRESH_HOURS_KEY,
  storageBgKey,
  storageBgModeKey,
} from "../domain/prefs";
import {
  clampFocalIdx,
  cssBackgroundImageUrl,
  focalCacheToEntry,
  isFocalRefreshDue,
  loadFocalCache,
  loadFocalRefreshHours,
  nextFocalIdx,
  parseFocalRefreshHours,
  parseThemeBgMode,
  pickFocalUrlForApply,
  resolveThemeBgMode,
  saveFocalCache,
  saveFocalRefreshHours,
  themeBgWashPct,
  utcDayIso,
  type FocalCacheEntry,
} from "./themeBg";

describe("cssBackgroundImageUrl / themeBgWashPct", () => {
  it("wraps and escapes URLs for CSS url()", () => {
    expect(cssBackgroundImageUrl("https://example.com/a.png")).toBe(
      'url("https://example.com/a.png")',
    );
    expect(cssBackgroundImageUrl('https://x.test/a"b')).toBe('url("https://x.test/a\\"b")');
  });

  it("maps opacity to inverse wash percent (bias −8pp, min 40% for readable glass)", () => {
    expect(themeBgWashPct(0.3)).toBe("62%");
    expect(themeBgWashPct(0.6)).toBe("40%");
    expect(themeBgWashPct(0.05)).toBe("87%");
  });
});

describe("parseThemeBgMode", () => {
  it("accepts none / custom / focal", () => {
    expect(parseThemeBgMode("none")).toBe("none");
    expect(parseThemeBgMode("custom")).toBe("custom");
    expect(parseThemeBgMode("focal")).toBe("focal");
    expect(parseThemeBgMode("  focal  ")).toBe("focal");
  });

  it("rejects unknown values", () => {
    expect(parseThemeBgMode(null)).toBeNull();
    expect(parseThemeBgMode(undefined)).toBeNull();
    expect(parseThemeBgMode("")).toBeNull();
    expect(parseThemeBgMode("unsplash")).toBeNull();
    expect(parseThemeBgMode("CUSTOM")).toBeNull();
  });
});

describe("resolveThemeBgMode legacy fallback", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to none without mode or image", () => {
    expect(resolveThemeBgMode("nord")).toBe("none");
  });

  it("treats existing custom image without mode as custom", () => {
    localStorage.setItem(storageBgKey("nord"), "data:image/png;base64,AAAA");
    expect(resolveThemeBgMode("nord")).toBe("custom");
  });

  it("honors explicit mode over image presence", () => {
    localStorage.setItem(storageBgKey("nord"), "data:image/png;base64,AAAA");
    localStorage.setItem(storageBgModeKey("nord"), "none");
    expect(resolveThemeBgMode("nord")).toBe("none");
    localStorage.setItem(storageBgModeKey("nord"), "focal");
    expect(resolveThemeBgMode("nord")).toBe("focal");
  });
});

describe("focal cache helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips cache JSON", () => {
    const entry: FocalCacheEntry = {
      day: "2026-08-12",
      locale: "zh-Hant",
      imageUrl: "https://www.bing.com/th?id=OHR.Test",
      title: "Test",
      copyright: "Test (© X)",
      idx: 2,
      fetchedAt: 99,
    };
    saveFocalCache(entry);
    expect(loadFocalCache()).toEqual(entry);
  });

  it("returns null for corrupt cache", () => {
    localStorage.setItem(THEME_FOCAL_CACHE_KEY, "{not-json");
    expect(loadFocalCache()).toBeNull();
  });

  it("pickFocalUrlForApply prefers same-day same-locale then last URL", () => {
    const day = utcDayIso();
    const fresh = {
      day,
      locale: "en",
      imageUrl: "https://example.com/today.jpg",
    };
    expect(pickFocalUrlForApply(fresh, "en", day)).toBe(fresh.imageUrl);
    const stale = {
      day: "2020-01-01",
      locale: "zh-Hans",
      imageUrl: "https://example.com/old.jpg",
    };
    expect(pickFocalUrlForApply(stale, "en", day)).toBe(stale.imageUrl);
    expect(pickFocalUrlForApply(null, "en", day)).toBeNull();
  });

  it("focalCacheToEntry maps API payload with idx + fetchedAt", () => {
    const entry = focalCacheToEntry(
      {
        imageUrl: "https://www.bing.com/th?id=x",
        title: "T",
        copyright: "C",
        locale: "zh-HK",
        source: "bing",
      },
      "zh-Hant",
      "2026-08-12",
      3,
      1_700_000_000_000,
    );
    expect(entry).toEqual({
      day: "2026-08-12",
      locale: "zh-Hant",
      imageUrl: "https://www.bing.com/th?id=x",
      title: "T",
      copyright: "C",
      idx: 3,
      fetchedAt: 1_700_000_000_000,
    });
  });

  it("round-trips idx in cache JSON", () => {
    saveFocalCache({
      day: "2026-08-12",
      locale: "en",
      imageUrl: "https://www.bing.com/th?id=OHR.Idx",
      idx: 5,
      fetchedAt: 123,
    });
    expect(loadFocalCache()?.idx).toBe(5);
    expect(loadFocalCache()?.fetchedAt).toBe(123);
  });
});

describe("focal idx cycle + refresh interval prefs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("clamps and advances idx in 0–7 cycle", () => {
    expect(clampFocalIdx(-1)).toBe(0);
    expect(clampFocalIdx(8)).toBe(7);
    expect(nextFocalIdx(0)).toBe(1);
    expect(nextFocalIdx(6)).toBe(7);
    expect(nextFocalIdx(7)).toBe(0);
  });

  it("parses and persists refresh hours (0 clears)", () => {
    expect(parseFocalRefreshHours("6")).toBe(6);
    expect(parseFocalRefreshHours("3")).toBe(0);
    expect(loadFocalRefreshHours()).toBe(0);
    saveFocalRefreshHours(12);
    expect(localStorage.getItem(THEME_FOCAL_REFRESH_HOURS_KEY)).toBe("12");
    expect(loadFocalRefreshHours()).toBe(12);
    saveFocalRefreshHours(0);
    expect(localStorage.getItem(THEME_FOCAL_REFRESH_HOURS_KEY)).toBeNull();
  });

  it("isFocalRefreshDue respects interval and fetchedAt", () => {
    expect(isFocalRefreshDue(null, 1, 1000)).toBe(true);
    expect(isFocalRefreshDue(null, 0, 1000)).toBe(false);
    const fresh: FocalCacheEntry = {
      day: "2026-08-12",
      locale: "en",
      imageUrl: "https://example.com/a.jpg",
      fetchedAt: 1_000,
    };
    expect(isFocalRefreshDue(fresh, 1, 1_000 + 3_600_000 - 1)).toBe(false);
    expect(isFocalRefreshDue(fresh, 1, 1_000 + 3_600_000)).toBe(true);
    const legacy: FocalCacheEntry = {
      day: "2026-08-12",
      locale: "en",
      imageUrl: "https://example.com/a.jpg",
    };
    expect(isFocalRefreshDue(legacy, 6, 1_000)).toBe(true);
  });
});

describe("refreshFocalBackground", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("caches successful API response", async () => {
    const fetchFocalBackground = vi.fn(async () => ({
      imageUrl: "https://www.bing.com/th?id=OHR.Mock",
      title: "Mock",
      copyright: "Mock (© M)",
      date: "20260812",
      locale: "en-US",
      source: "bing",
    }));
    vi.doMock("../api/theme", () => ({
      fetchFocalBackground,
      fetchFocalBackgroundImage: vi.fn(async () => new Blob(["img"], { type: "image/jpeg" })),
    }));
    vi.doMock("../i18n/locale", () => ({
      getAppLocale: () => "en",
    }));
    const { refreshFocalBackground, loadFocalCache } = await import("./themeBg");
    const entry = await refreshFocalBackground("en");
    expect(entry?.imageUrl).toContain("OHR.Mock");
    expect(loadFocalCache()?.imageUrl).toContain("OHR.Mock");
    expect(loadFocalCache()?.idx).toBe(0);
    expect(fetchFocalBackground).toHaveBeenCalledWith({ locale: "en", idx: 0 });
  });

  it("advanceFocalBackground bumps idx and passes it to the API", async () => {
    const fetchFocalBackground = vi.fn(async ({ idx }: { idx?: number }) => ({
      imageUrl: `https://www.bing.com/th?id=OHR.Idx${idx ?? 0}`,
      title: `Idx ${idx ?? 0}`,
      copyright: "C",
      date: "20260812",
      locale: "en-US",
      source: "bing",
    }));
    vi.doMock("../api/theme", () => ({
      fetchFocalBackground,
      fetchFocalBackgroundImage: vi.fn(async () => new Blob(["img"], { type: "image/jpeg" })),
    }));
    vi.doMock("../i18n/locale", () => ({
      getAppLocale: () => "en",
    }));
    const { advanceFocalBackground, loadFocalCache, saveFocalCache, utcDayIso } =
      await import("./themeBg");
    saveFocalCache({
      day: utcDayIso(),
      locale: "en",
      imageUrl: "https://www.bing.com/th?id=OHR.Idx0",
      idx: 0,
      fetchedAt: Date.now(),
    });
    const entry = await advanceFocalBackground("en");
    expect(entry?.idx).toBe(1);
    expect(entry?.imageUrl).toContain("Idx1");
    expect(loadFocalCache()?.idx).toBe(1);
    expect(fetchFocalBackground).toHaveBeenCalledWith({ locale: "en", idx: 1 });
  });

  it("materializeFocalApplyUrl prefers blob object URL over Bing hotlink", async () => {
    const createObjectURL = vi.fn(() => "blob:http://localhost/focal-test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    vi.doMock("../api/theme", () => ({
      fetchFocalBackground: vi.fn(async () => ({
        imageUrl: "https://www.bing.com/th?id=OHR.Blob",
        title: "Blob",
        copyright: "Blob",
        date: "20260812",
        locale: "en-US",
        source: "bing",
      })),
      fetchFocalBackgroundImage: vi.fn(async () => new Blob(["jpeg-bytes"], { type: "image/jpeg" })),
    }));
    vi.doMock("../i18n/locale", () => ({
      getAppLocale: () => "en",
    }));
    const { materializeFocalApplyUrl } = await import("./themeBg");
    const url = await materializeFocalApplyUrl("en");
    expect(url).toBe("blob:http://localhost/focal-test");
    expect(createObjectURL).toHaveBeenCalledOnce();
  });

  it("materializeFocalApplyUrl falls back to Bing URL when image proxy fails", async () => {
    vi.doMock("../api/theme", () => ({
      fetchFocalBackground: vi.fn(async () => ({
        imageUrl: "https://www.bing.com/th?id=OHR.Fallback",
        title: "Fallback",
        copyright: "Fallback",
        date: "20260812",
        locale: "en-US",
        source: "bing",
      })),
      fetchFocalBackgroundImage: vi.fn(async () => {
        throw new Error("proxy down");
      }),
    }));
    vi.doMock("../i18n/locale", () => ({
      getAppLocale: () => "en",
    }));
    const { materializeFocalApplyUrl } = await import("./themeBg");
    const url = await materializeFocalApplyUrl("en");
    expect(url).toContain("OHR.Fallback");
  });
});
