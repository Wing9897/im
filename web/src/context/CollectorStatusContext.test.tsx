import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CollectorStatusProvider,
  useCollectorStatus,
  type CollectorStatusContextValue,
} from "./CollectorStatusContext";

let latestValue: CollectorStatusContextValue | null = null;

function CollectorStatusHarness() {
  latestValue = useCollectorStatus();
  return null;
}

describe("CollectorStatusContext", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    latestValue = null;
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

  it("throws a descriptive error when used outside provider", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      act(() => {
        root = createRoot(container);
        root.render(<CollectorStatusHarness />);
      });
    }).toThrow(
      "useCollectorStatus must be used within a <CollectorStatusProvider>",
    );

    expect(consoleError).toHaveBeenCalled();
  });

  it("provides collector and engine status values from the provider", () => {
    const mockRefresh = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <CollectorStatusProvider
          collectorStatus="running"
          aiEngineStatus="available"
          requestAiStatusRefresh={mockRefresh}
        >
          <CollectorStatusHarness />
        </CollectorStatusProvider>,
      );
    });

    expect(latestValue).not.toBeNull();
    expect(latestValue!.collectorStatus).toBe("running");
    expect(latestValue!.aiEngineStatus).toBe("available");
    expect(latestValue!.requestAiStatusRefresh).toBe(mockRefresh);
  });

  it("updates when provider props change", () => {
    const mockRefresh = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <CollectorStatusProvider
          collectorStatus="starting"
          aiEngineStatus="unknown"
          requestAiStatusRefresh={mockRefresh}
        >
          <CollectorStatusHarness />
        </CollectorStatusProvider>,
      );
    });

    expect(latestValue!.collectorStatus).toBe("starting");
    expect(latestValue!.aiEngineStatus).toBe("unknown");

    act(() => {
      root!.render(
        <CollectorStatusProvider
          collectorStatus="running"
          aiEngineStatus="available"
          requestAiStatusRefresh={mockRefresh}
        >
          <CollectorStatusHarness />
        </CollectorStatusProvider>,
      );
    });

    expect(latestValue!.collectorStatus).toBe("running");
    expect(latestValue!.aiEngineStatus).toBe("available");
  });
});
