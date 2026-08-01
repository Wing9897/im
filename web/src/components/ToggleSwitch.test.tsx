import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToggleSwitch } from "./ToggleSwitch";

describe("ToggleSwitch", () => {
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
    vi.restoreAllMocks();
  });

  it('renders in checked state with aria-checked="true"', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch checked={true} onChange={vi.fn()} label="Test toggle" />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]');
    expect(switchEl).not.toBeNull();
    expect(switchEl!.getAttribute("aria-checked")).toBe("true");
  });

  it('renders in unchecked state with aria-checked="false"', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch checked={false} onChange={vi.fn()} label="Test toggle" />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]');
    expect(switchEl).not.toBeNull();
    expect(switchEl!.getAttribute("aria-checked")).toBe("false");
  });

  it("calls onChange with true when clicking an unchecked toggle", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch checked={false} onChange={onChange} label="Test toggle" />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    act(() => {
      switchEl.click();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when clicking a checked toggle", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch checked={true} onChange={onChange} label="Test toggle" />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    act(() => {
      switchEl.click();
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does NOT call onChange when disabled and clicked", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch
          checked={false}
          onChange={onChange}
          disabled={true}
          label="Test toggle"
        />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    act(() => {
      switchEl.click();
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('has aria-disabled="true" when disabled', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch
          checked={false}
          onChange={vi.fn()}
          disabled={true}
          label="Test toggle"
        />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]');
    expect(switchEl).not.toBeNull();
    expect(switchEl!.getAttribute("aria-disabled")).toBe("true");
  });

  it("triggers onChange when Space key is pressed", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch checked={false} onChange={onChange} label="Test toggle" />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    act(() => {
      switchEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("triggers onChange when Enter key is pressed", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch checked={true} onChange={onChange} label="Test toggle" />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    act(() => {
      switchEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does NOT trigger onChange on keyboard when disabled", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ToggleSwitch
          checked={false}
          onChange={onChange}
          disabled={true}
          label="Test toggle"
        />,
      );
    });

    const switchEl = container.querySelector('[role="switch"]') as HTMLElement;
    act(() => {
      switchEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true }),
      );
    });
    act(() => {
      switchEl.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
