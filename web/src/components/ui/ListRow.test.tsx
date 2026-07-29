import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ListRow, ListRowTime, ListRowMain, ListRowMeta, ListRowDetail } from "./ListRow";

describe("ListRow", () => {
  it("renders row layout classes", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(ListRow, { "data-testid": "row" }, "content"),
      );
    });
    const row = container.querySelector("[data-testid='row']") as HTMLElement;
    expect(row.className).toContain("flex");
    expect(row.className).toContain("min-h-12");
  });

  it("renders time column with monospace styling", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(ListRowTime, { dateTime: "2026-01-01" }, "12:00"),
      );
    });
    const time = container.querySelector("time") as HTMLElement;
    expect(time.className).toContain("font-mono");
    expect(time.className).toContain("w-[140px]");
  });

  it("renders main with ellipsis", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          ListRowMain,
          null,
          "Title",
          createElement(ListRowDetail, null, "detail"),
        ),
      );
    });
    const main = container.querySelector("span") as HTMLElement;
    expect(main.className).toContain("text-ellipsis");
  });

  it("renders meta with caps styling", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(ListRowMeta, null, "API"));
    });
    const meta = container.querySelector("span") as HTMLElement;
    expect(meta.className).toContain("uppercase");
  });
});
