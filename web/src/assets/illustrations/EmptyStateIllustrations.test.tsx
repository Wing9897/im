import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  EmptyStateIntelligence,
  EmptyStateSources,
} from "./EmptyStateIllustrations";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let container: HTMLElement;
let root: Root;

function renderComponent(ui: React.ReactNode) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(ui);
  });
}

function cleanup() {
  act(() => {
    root.unmount();
  });
  container.remove();
}

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/*  Tests: EmptyStateIllustrations                                     */
/* ------------------------------------------------------------------ */

describe("EmptyStateIllustrations", () => {
  const illustrations = [
    { name: "EmptyStateIntelligence", Component: EmptyStateIntelligence },
    { name: "EmptyStateSources", Component: EmptyStateSources },
  ];

  for (const { name, Component } of illustrations) {
    describe(name, () => {
      it("renders an SVG element with viewBox='0 0 200 160'", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        expect(svg!.getAttribute("viewBox")).toBe("0 0 200 160");
      });

      it("defaults to maxWidth 200 and maxHeight 160", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg") as SVGElement;
        expect(svg.style.maxWidth).toBe("200px");
        expect(svg.style.maxHeight).toBe("160px");
      });

      it("has aria-hidden='true' when no ariaLabel is provided", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg");
        expect(svg!.getAttribute("aria-hidden")).toBe("true");
        expect(svg!.getAttribute("aria-label")).toBeNull();
        expect(svg!.getAttribute("role")).toBeNull();
      });

      it("has role='img' and aria-label when ariaLabel is provided", () => {
        renderComponent(<Component ariaLabel="Empty state description" />);
        const svg = container.querySelector("svg");
        expect(svg!.getAttribute("aria-label")).toBe("Empty state description");
        expect(svg!.getAttribute("role")).toBe("img");
        expect(svg!.getAttribute("aria-hidden")).toBeNull();
      });

      it("accepts custom maxWidth and maxHeight", () => {
        renderComponent(<Component maxWidth={300} maxHeight={240} />);
        const svg = container.querySelector("svg") as SVGElement;
        expect(svg.style.maxWidth).toBe("300px");
        expect(svg.style.maxHeight).toBe("240px");
      });

      it("renders centered with display block and margin auto", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg") as SVGElement;
        expect(svg.style.display).toBe("block");
        expect(svg.style.margin).toBe("0px auto");
      });
    });
  }
});
