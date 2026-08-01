import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PageBreadcrumb } from "./PageBreadcrumb";

describe("PageBreadcrumb", () => {
  it("renders trail with current page marked", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(PageBreadcrumb, {
            items: [
              { label: "系統設定", to: "/settings" },
              { label: "系統日誌" },
            ],
          }),
        ),
      );
    });

    expect(container.querySelector('[aria-label="麵包屑"]')).not.toBeNull();
    expect(container.textContent).toContain("系統設定");
    expect(container.textContent).toContain("系統日誌");
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("系統日誌");
    expect(container.querySelector('a[href="/settings"]')).not.toBeNull();
  });
});
