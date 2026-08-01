import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { useWallMediaCache } from "./useWallMediaCache";

describe("useWallMediaCache", () => {
  it("stores and revokes object URLs", () => {
    const revokeSpy = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeSpy,
    });

    let cacheApi: ReturnType<typeof useWallMediaCache> | null = null;
    function Harness() {
      cacheApi = useWallMediaCache(2);
      return null;
    }

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(createElement(Harness));
    });

    expect(cacheApi!.get("m1")).toBeUndefined();
    cacheApi!.put("m1", "blob:1");
    expect(cacheApi!.get("m1")).toBe("blob:1");
    cacheApi!.put("m2", "blob:2");
    expect(cacheApi!.get("m1")).toBe("blob:1");
    cacheApi!.put("m3", "blob:3");
    expect(cacheApi!.get("m2")).toBeUndefined();
    expect(revokeSpy).toHaveBeenCalledWith("blob:2");

    expect(cacheApi!.put("m3", "blob:duplicate")).toBe("blob:3");
    expect(revokeSpy).toHaveBeenCalledWith("blob:duplicate");

    cacheApi!.revokeExcept(new Set(["m3"]));
    expect(revokeSpy).toHaveBeenCalledWith("blob:1");

    act(() => {
      root.unmount();
    });
    Reflect.deleteProperty(URL, "revokeObjectURL");
  });
});
