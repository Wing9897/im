import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OvernightClockHint } from "./OvernightClockHint";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function renderHint(props: Partial<Parameters<typeof OvernightClockHint>[0]> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <OvernightClockHint startClock="22:00" endClock="06:00" {...props} />,
    );
  });
  return { container, root };
}

function cleanup(root: Root, container: HTMLElement) {
  act(() => {
    root.unmount();
  });
  container.remove();
}

describe("OvernightClockHint", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders unified overnight copy when end is before start", () => {
    const { container, root } = renderHint();
    const hint = container.querySelector('[data-testid="overnight-clock-hint"]');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe("overnightClockHint");
    cleanup(root, container);
  });

  it("returns null for same-day ranges", () => {
    const { container, root } = renderHint({
      startClock: "09:00",
      endClock: "10:00",
    });
    expect(container.querySelector('[data-testid="overnight-clock-hint"]')).toBeNull();
    cleanup(root, container);
  });

  it("honors a custom testId", () => {
    const { container, root } = renderHint({ testId: "custom-overnight" });
    expect(container.querySelector('[data-testid="custom-overnight"]')).not.toBeNull();
    cleanup(root, container);
  });
});
