import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { DiscordLogo, TelegramLogo, MqttLogo } from "./PlatformLogos";

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
/*  Tests: PlatformLogos                                               */
/* ------------------------------------------------------------------ */

describe("PlatformLogos", () => {
  const logos = [
    { name: "DiscordLogo", Component: DiscordLogo },
    { name: "TelegramLogo", Component: TelegramLogo },
    { name: "MqttLogo", Component: MqttLogo },
  ];

  for (const { name, Component } of logos) {
    describe(name, () => {
      it("renders an SVG element with viewBox='0 0 24 24'", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg");
        expect(svg).not.toBeNull();
        expect(svg!.getAttribute("viewBox")).toBe("0 0 24 24");
      });

      it("uses fill='currentColor'", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg");
        expect(svg!.getAttribute("fill")).toBe("currentColor");
      });

      it("defaults to 20×20px size", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg");
        expect(svg!.getAttribute("width")).toBe("20");
        expect(svg!.getAttribute("height")).toBe("20");
      });

      it("accepts a custom size prop", () => {
        renderComponent(<Component size={32} />);
        const svg = container.querySelector("svg");
        expect(svg!.getAttribute("width")).toBe("32");
        expect(svg!.getAttribute("height")).toBe("32");
      });

      it("has aria-hidden='true'", () => {
        renderComponent(<Component />);
        const svg = container.querySelector("svg");
        expect(svg!.getAttribute("aria-hidden")).toBe("true");
      });

      it("accepts a custom className prop", () => {
        renderComponent(<Component className="custom-class" />);
        const svg = container.querySelector("svg");
        expect(svg!.classList.contains("custom-class")).toBe(true);
      });
    });
  }
});
