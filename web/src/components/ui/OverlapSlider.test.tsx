import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import i18n from "../../i18n";
import { OverlapSlider } from "./OverlapSlider";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function renderSlider(value: string, onChange = vi.fn()) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      createElement(OverlapSlider, { value, onChange }),
    );
  });
  return { container, onChange };
}

function getSliderInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector('input[type="range"]') as HTMLInputElement;
  expect(input).not.toBeNull();
  return input;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("OverlapSlider", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
  });

  it("renders with initial value", () => {
    const { container } = renderSlider("5");
    const input = getSliderInput(container);
    expect(input.value).toBe("5");
  });

  it("renders with value 0", () => {
    const { container } = renderSlider("0");
    const input = getSliderInput(container);
    expect(input.value).toBe("0");
  });

  it("renders with value 10", () => {
    const { container } = renderSlider("10");
    const input = getSliderInput(container);
    expect(input.value).toBe("10");
  });

  it("treats non-numeric value as 0", () => {
    const { container } = renderSlider("abc");
    const input = getSliderInput(container);
    expect(input.value).toBe("0");
  });

  describe("ARIA attributes", () => {
    it("uses i18n aria-label for the overlap slider", () => {
      const { container } = renderSlider("3");
      const input = getSliderInput(container);
      expect(input.getAttribute("aria-label")).toBe("批次重疊訊息數量");
    });

    it("has aria-valuemin set to 0", () => {
      const { container } = renderSlider("3");
      const input = getSliderInput(container);
      expect(input.getAttribute("aria-valuemin")).toBe("0");
    });

    it("has aria-valuemax set to 10", () => {
      const { container } = renderSlider("3");
      const input = getSliderInput(container);
      expect(input.getAttribute("aria-valuemax")).toBe("10");
    });

    it("has aria-valuenow reflecting the current value", () => {
      const { container } = renderSlider("7");
      const input = getSliderInput(container);
      expect(input.getAttribute("aria-valuenow")).toBe("7");
    });

    it("has aria-valuenow as 0 for non-numeric input", () => {
      const { container } = renderSlider("invalid");
      const input = getSliderInput(container);
      expect(input.getAttribute("aria-valuenow")).toBe("0");
    });
  });

  describe("onChange callback", () => {
    it("fires with correct value on slider adjustment", () => {
      const onChange = vi.fn();
      const { container } = renderSlider("3", onChange);
      const input = getSliderInput(container);

      act(() => {
        const event = new Event("input", { bubbles: true });
        Object.defineProperty(event, "target", {
          value: { value: "7" },
          writable: false,
        });
        // Use native value setter to simulate React's synthetic event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!;
        nativeInputValueSetter.call(input, "7");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith("7");
    });

    it("fires with value 0 when slider moved to minimum", () => {
      const onChange = vi.fn();
      const { container } = renderSlider("5", onChange);
      const input = getSliderInput(container);

      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!;
        nativeInputValueSetter.call(input, "0");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith("0");
    });

    it("fires with value 10 when slider moved to maximum", () => {
      const onChange = vi.fn();
      const { container } = renderSlider("5", onChange);
      const input = getSliderInput(container);

      act(() => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!;
        nativeInputValueSetter.call(input, "10");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });

      expect(onChange).toHaveBeenCalledWith("10");
    });
  });

  describe("value label", () => {
    it("displays the current numeric value", () => {
      const { container } = renderSlider("5");
      const spans = container.querySelectorAll("span");
      const valueSpan = Array.from(spans).find((s) => s.textContent === "5");
      expect(valueSpan).not.toBeUndefined();
    });

    it("displays 0 for non-numeric value", () => {
      const { container } = renderSlider("xyz");
      const spans = container.querySelectorAll("span");
      const valueSpan = Array.from(spans).find((s) => s.textContent === "0");
      expect(valueSpan).not.toBeUndefined();
    });

    it("displays 10 when value is 10", () => {
      const { container } = renderSlider("10");
      const spans = container.querySelectorAll("span");
      const valueSpan = Array.from(spans).find((s) => s.textContent === "10");
      expect(valueSpan).not.toBeUndefined();
    });
  });
});
