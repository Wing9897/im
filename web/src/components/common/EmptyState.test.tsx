import { describe, it, expect } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "No messages",
          description: "There are no messages to display.",
        })
      );
    });
    expect(container.textContent).toContain("No messages");
    expect(container.textContent).toContain("There are no messages to display.");
  });

  it("has role='status' attribute", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
        })
      );
    });
    const statusEl = container.querySelector("[role='status']");
    expect(statusEl).not.toBeNull();
  });

  it("renders hint when provided", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
          hint: "Try adjusting your filters.",
        })
      );
    });
    expect(container.textContent).toContain("Try adjusting your filters.");
  });

  it("does not render hint when not provided", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
        })
      );
    });
    expect(container.textContent).not.toContain("Try adjusting");
  });

  it("renders actions when provided", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
          actions: createElement("button", null, "Reset"),
        })
      );
    });
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toBe("Reset");
  });

  it("renders in compact mode with smaller padding", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Compact",
          description: "Compact mode.",
          compact: true,
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    expect(statusEl).not.toBeNull();
    expect(statusEl.className).toContain("px-lg");
    expect(statusEl.className).toContain("py-xl");
    expect(statusEl.className).toContain("min-h-[160px]");
  });

  it("renders in normal mode with larger padding", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Normal",
          description: "Normal mode.",
          compact: false,
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    expect(statusEl).not.toBeNull();
    expect(statusEl.className).toContain("px-4xl");
    expect(statusEl.className).toContain("py-4xl");
    expect(statusEl.className).toContain("min-h-[360px]");
  });

  it("triggers action button click", () => {
    const container = document.createElement("div");
    let clicked = false;
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
          actions: createElement("button", { onClick: () => { clicked = true; } }, "Reset"),
        })
      );
    });
    const btn = container.querySelector("button")!;
    act(() => {
      btn.click();
    });
    expect(clicked).toBe(true);
  });

  /* ------------------------------------------------------------------ */
  /*  Upgraded visual elements (Requirement 5.1, 15.3)                   */
  /* ------------------------------------------------------------------ */

  it("normal mode has minimum height of 360px", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
          compact: false,
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    expect(statusEl.className).toContain("min-h-[360px]");
  });

  it("renders illustration when provided", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "No Data",
          description: "Nothing to show.",
          illustration: createElement("svg", { "data-testid": "illustration" }),
        })
      );
    });
    const svg = container.querySelector("[data-testid='illustration']");
    expect(svg).not.toBeNull();
  });

  it("does not render illustration container when not provided", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "No Data",
          description: "Nothing to show.",
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    const children = Array.from(statusEl.children);
    const firstChild = children[0] as HTMLElement;
    expect(firstChild.className).not.toContain("h-16");
  });

  it("illustration container has 64px dimensions", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "No Data",
          description: "Nothing to show.",
          illustration: createElement("svg", null),
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    const illustrationContainer = statusEl.children[0] as HTMLElement;
    expect(illustrationContainer.className).toContain("h-16");
    expect(illustrationContainer.className).toContain("w-16");
  });

  it("normal mode has radial gradient background", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
          compact: false,
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    expect(statusEl.className).toContain("bg-[radial-gradient");
  });

  it("has border-radius of 12px in normal mode", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Empty",
          description: "Nothing here.",
          compact: false,
        })
      );
    });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    expect(statusEl.className).toContain("rounded-lg");
  });

  it("uses section title typography for title", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "No Data",
          description: "Nothing to show.",
        })
      );
    });
    const titleEl = container.querySelector("[role='status']")!.children[0] as HTMLElement;
    expect(titleEl.className).toContain("text-section-title");
  });

  it("preserves existing API — compact prop still works", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(EmptyState, {
          title: "Compact",
          description: "Compact mode.",
          compact: true,
          illustration: createElement("span", null, "🔍"),
          hint: "A hint",
          actions: createElement("button", null, "Action"),
        })
      );
    });
    expect(container.textContent).toContain("Compact");
    expect(container.textContent).toContain("Compact mode.");
    expect(container.textContent).toContain("🔍");
    expect(container.textContent).toContain("A hint");
    expect(container.textContent).toContain("Action");
  });
});
