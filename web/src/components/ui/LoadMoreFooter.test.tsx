import { describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { LoadMoreFooter } from "./LoadMoreFooter";

describe("LoadMoreFooter", () => {
  it("renders hint and load-more button when more is available", () => {
    const onLoadMore = vi.fn();
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(LoadMoreFooter, {
          hint: "向下捲動以顯示更多",
          hasMore: true,
          loadingMore: false,
          onLoadMore,
          loadMoreAriaLabel: "載入更多關鍵事件",
          asDataListFooter: false,
        }),
      );
    });

    expect(container.textContent).toContain("向下捲動以顯示更多");
    const button = container.querySelector("button");
    expect(button?.getAttribute("aria-label")).toBe("載入更多關鍵事件");
    act(() => {
      button?.click();
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("hides the button while loadingMore", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(LoadMoreFooter, {
          hint: "載入中…",
          hasMore: true,
          loadingMore: true,
          onLoadMore: () => {},
          asDataListFooter: false,
        }),
      );
    });
    expect(container.querySelector("button")).toBeNull();
  });
});
