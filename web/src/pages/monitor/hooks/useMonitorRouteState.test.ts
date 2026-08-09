import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import { useMonitorRouteState } from "./useMonitorRouteState";

function Harness({ onViewMode }: { onViewMode: (mode: string) => void }) {
  useMonitorRouteState(onViewMode as never);
  return null;
}

function SecondDeepLinkHarness({ onViewMode }: { onViewMode: (mode: string) => void }) {
  const navigate = useNavigate();
  useMonitorRouteState(onViewMode as never);
  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "to-wall-query",
        onClick: () => navigate("/monitor?view=wall"),
      },
      "wall query",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "to-list-state",
        onClick: () => navigate("/monitor", { state: { monitorViewMode: "list" } }),
      },
      "list state",
    ),
  );
}

describe("useMonitorRouteState", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("applies wall view from location state and clears it", async () => {
    const onViewMode = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          {
            initialEntries: [{ pathname: "/monitor", state: { monitorViewMode: "wall" } }],
          },
          createElement(Routes, null, createElement(Route, { path: "/monitor", element: createElement(Harness, { onViewMode }) })),
        ),
      );
      await Promise.resolve();
    });

    expect(onViewMode).toHaveBeenCalledWith("wall");
  });

  it("ignores navigation without monitor view state", async () => {
    const onViewMode = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor"] },
          createElement(Routes, null, createElement(Route, { path: "/monitor", element: createElement(Harness, { onViewMode }) })),
        ),
      );
      await Promise.resolve();
    });

    expect(onViewMode).not.toHaveBeenCalled();
  });

  it("applies a second ?view= deep link after the first was consumed", async () => {
    const onViewMode = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor?view=card"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/monitor",
              element: createElement(SecondDeepLinkHarness, { onViewMode }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onViewMode).toHaveBeenCalledWith("card");
    onViewMode.mockClear();

    await act(async () => {
      (container.querySelector('[data-testid="to-wall-query"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onViewMode).toHaveBeenCalledWith("wall");
  });

  it("applies a second location.state monitorViewMode after the first was consumed", async () => {
    const onViewMode = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          {
            initialEntries: [{ pathname: "/monitor", state: { monitorViewMode: "wall" } }],
          },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/monitor",
              element: createElement(SecondDeepLinkHarness, { onViewMode }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onViewMode).toHaveBeenCalledWith("wall");
    onViewMode.mockClear();

    await act(async () => {
      (container.querySelector('[data-testid="to-list-state"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onViewMode).toHaveBeenCalledWith("list");
  });
});
