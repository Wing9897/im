import { act, createElement, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { OpsControlBar } from "./OpsControlBar";

function renderBar(props: Partial<ComponentProps<typeof OpsControlBar>> = {}) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(
        OpsControlBar,
        {
          ariaLabel: "測試工具列",
          ...props,
        },
        createElement("span", null, "controls"),
      ),
    );
  });
  return container;
}

describe("OpsControlBar", () => {
  it("uses role=toolbar with aria-label", () => {
    const container = renderBar({ ariaLabel: "監控工具列" });
    const toolbar = container.querySelector('[role="toolbar"]')!;
    expect(toolbar.getAttribute("aria-label")).toBe("監控工具列");
    expect(toolbar.textContent).toContain("controls");
  });

  it("applies im-control-bar and sticky classes when sticky", () => {
    const container = renderBar({ sticky: true });
    const toolbar = container.querySelector('[role="toolbar"]')!;
    expect(toolbar.className).toContain("im-control-bar");
    expect(toolbar.className).toContain("sticky");
    expect(toolbar.className).toContain("top-0");
    expect(toolbar.className).toContain("z-[100]");
  });

  it("merges caller className for page-specific chrome", () => {
    const container = renderBar({ className: "im-timeline-toolbar !mb-lg" });
    const toolbar = container.querySelector('[role="toolbar"]')!;
    expect(toolbar.className).toContain("im-timeline-toolbar");
    expect(toolbar.className).toContain("!mb-lg");
  });
});
