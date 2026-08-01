import { describe, it, expect, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PlatformIcon } from "./PlatformIcon";

let container: HTMLElement;
let root: Root;

function renderIcon(platform: string | null) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(PlatformIcon, { platform, size: 14 }));
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("PlatformIcon", () => {
  it("renders Telegram logo with brand color for telegram platform", () => {
    renderIcon("telegram");
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute("class") ?? "").toContain("text-[var(--platform-telegram)]");
    expect(svg!.querySelector("path")).toBeTruthy();
  });

  it("renders lucide Rss for rss platform", () => {
    renderIcon("rss");
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("returns null when platform is null", () => {
    renderIcon(null);
    expect(container.querySelector("svg")).toBeNull();
  });

  it("falls back to Globe for unknown platforms", () => {
    renderIcon("custom-feed");
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
