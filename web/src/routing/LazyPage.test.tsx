import { describe, expect, it, beforeEach, vi } from "vitest";
import { resetLazyPageCacheForTests, lazyNamed } from "./LazyPage";

describe("lazyNamed", () => {
  beforeEach(() => {
    resetLazyPageCacheForTests();
  });

  it("reuses the same React.lazy type across calls (stable for route elements)", () => {
    const loader = () =>
      Promise.resolve({
        DemoPage: function DemoPage() {
          return null;
        },
      });

    const first = lazyNamed(loader, "DemoPage");
    const second = lazyNamed(loader, "DemoPage");

    expect(first).toBe(second);
  });

  it("caches by export name so AppRoutes re-renders do not remount pages", () => {
    const spy = vi.fn(() =>
      Promise.resolve({
        OtherPage: function OtherPage() {
          return null;
        },
      }),
    );

    lazyNamed(spy, "OtherPage");
    lazyNamed(spy, "OtherPage");
    lazyNamed(spy, "OtherPage");

    // React.lazy only invokes the loader when the component mounts; registry
    // must still hold a single Lazy exotic so type identity is stable.
    const a = lazyNamed(spy, "OtherPage");
    const b = lazyNamed(spy, "OtherPage");
    expect(a).toBe(b);
  });
});
