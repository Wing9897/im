import { describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { NotifyPrefField } from "./NotifyPrefField";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("NotifyPrefField", () => {
  it("renders a labeled switch and reports inherit / off", async () => {
    const onChange = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(host);
      root.render(createElement(NotifyPrefField, { value: "inherit", onChange }));
    });
    const toggle = host.querySelector<HTMLElement>('[data-testid="notify-pref-field"]');
    expect(toggle?.getAttribute("role")).toBe("switch");
    expect(toggle?.getAttribute("aria-checked")).toBe("true");
    expect(toggle?.className).not.toContain("im-surface-inset");
    await act(async () => {
      toggle!.click();
    });
    expect(onChange).toHaveBeenCalledWith("off");
    act(() => {
      root?.unmount();
    });
    host.remove();
  });

  it("renders a tile switch with an accessible name", async () => {
    const onChange = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    let root: Root | null = null;
    await act(async () => {
      root = createRoot(host);
      root.render(
        createElement(NotifyPrefField, { value: "inherit", onChange, variant: "tile" }),
      );
    });
    const tile = host.querySelector<HTMLButtonElement>('[data-testid="notify-pref-field"]');
    expect(tile?.getAttribute("role")).toBe("switch");
    expect(tile?.getAttribute("aria-checked")).toBe("true");
    expect(tile?.getAttribute("aria-label")).toBe("notify.prefAria");
    await act(async () => {
      tile!.click();
    });
    expect(onChange).toHaveBeenCalledWith("off");
    act(() => {
      root?.unmount();
    });
    host.remove();
  });
});
