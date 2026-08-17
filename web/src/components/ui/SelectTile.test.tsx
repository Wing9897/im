import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelectTile } from "./SelectTile";

describe("SelectTile", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("keeps mutually exclusive picks as aria-pressed without a switch", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(SelectTile, { active: true, onClick: vi.fn() }, "員工"),
      );
    });
    const tile = container.querySelector("button");
    expect(tile?.getAttribute("aria-pressed")).toBe("true");
    expect(tile?.getAttribute("role")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });

  it("shows a switch track and aria-checked for independent toggles", () => {
    const onClick = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          SelectTile,
          {
            variant: "toggle",
            active: false,
            onClick,
            "aria-label": "啟用 MCP",
            "data-testid": "toggle-tile",
          },
          "啟用 MCP",
        ),
      );
    });
    const tile = container.querySelector<HTMLButtonElement>('[data-testid="toggle-tile"]');
    expect(tile?.getAttribute("role")).toBe("switch");
    expect(tile?.getAttribute("aria-checked")).toBe("false");
    expect(tile?.getAttribute("aria-pressed")).toBeNull();
    expect(tile?.getAttribute("aria-label")).toBe("啟用 MCP");
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    act(() => {
      tile!.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
