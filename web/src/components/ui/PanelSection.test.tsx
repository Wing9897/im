import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { PanelSection } from "./PanelSection";

describe("PanelSection", () => {
  it("renders title and body", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          PanelSection,
          { title: "通知規則", itemCount: 4, showCount: true },
          createElement("p", null, "Body content"),
        ),
      );
    });
    expect(container.textContent).toContain("通知規則");
    expect(container.textContent).toContain("Body content");
    expect(container.textContent).toContain("4");
  });

  it("renders header actions when provided", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          PanelSection,
          {
            title: "Sources",
            itemCount: 0,
            showCount: false,
            headerActions: createElement("button", null, "Add"),
          },
          null,
        ),
      );
    });
    expect(container.querySelector("button")!.textContent).toBe("Add");
  });

  it("uses section aria-label from title", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(PanelSection, { title: "RSS 來源", itemCount: 1 }, null),
      );
    });
    expect(container.querySelector("section")!.getAttribute("aria-label")).toBe("RSS 來源");
  });

  it("uses a column flex shell that cannot shrink below content", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(PanelSection, { title: "任務" }, createElement("p", null, "Body")),
      );
    });
    const cls = container.querySelector("section")!.className;
    expect(cls).toContain("flex-col");
    expect(cls).toContain("min-h-fit");
    expect(cls).toContain("overflow-visible");
  });

  it("surface=none omits im-surface-panel for nested board columns", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(PanelSection, { title: "List", surface: "none" }, null),
      );
    });
    const cls = container.querySelector("section")!.className;
    expect(cls).not.toContain("im-surface-panel");
    expect(cls).toContain("bg-transparent");
  });

  it("renders an optional leading icon before the title", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          PanelSection,
          {
            title: "任務",
            icon: createElement("span", { "data-testid": "section-icon" }, "icon"),
          },
          null,
        ),
      );
    });
    expect(container.querySelector('[data-testid="section-icon"]')).not.toBeNull();
    expect(container.textContent).toContain("任務");
  });
});
