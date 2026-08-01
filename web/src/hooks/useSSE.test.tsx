import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SseEvent } from "../api/client";
import { useSSE, type SSEConnectionStatus, type UseSSEOptions } from "./useSSE";

// ---------------------------------------------------------------------------
// Mock apiClient.connectSSE
// ---------------------------------------------------------------------------

// Capture the callbacks passed to connectSSE so tests can simulate the session
// lifecycle. `onOpen` fires for every open the client makes, reconnects
// included, so tests replay a reconnect by calling it again.
let capturedOnEvent: ((event: SseEvent) => void) | null = null;
let capturedOnError: ((error: Event) => void) | null = null;
let capturedOnOpen: (() => void) | null = null;
let mockConnection: { close: ReturnType<typeof vi.fn> };

const mockConnectSSE = vi.fn(() => {
  mockConnection = { close: vi.fn() };
  return mockConnection;
});

vi.mock("../api/client", () => ({
  apiClient: {
    connectSSE: (...args: unknown[]) => {
      capturedOnEvent = args[0] as (event: SseEvent) => void;
      const options = (args[1] ?? {}) as {
        onOpen?: () => void;
        onError?: (error: Event) => void;
      };
      capturedOnOpen = options.onOpen ?? null;
      capturedOnError = options.onError ?? null;
      return mockConnectSSE(...args as []);
    },
  },
}));

// ---------------------------------------------------------------------------
// Test Harness
// ---------------------------------------------------------------------------

let latest: { status: SSEConnectionStatus; disconnect: () => void; reconnect: () => void } | null = null;

function Harness({ options }: { options: UseSSEOptions }) {
  const result = useSSE(options);
  latest = result;
  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useSSE", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    capturedOnEvent = null;
    capturedOnError = null;
    capturedOnOpen = null;
    mockConnectSSE.mockClear();
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  it("connects to SSE on mount and starts with connecting status", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    expect(mockConnectSSE).toHaveBeenCalledTimes(1);
    expect(latest!.status).toBe("connecting");
  });

  it("transitions to connected status when onopen fires", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    // Simulate the EventSource open event
    act(() => {
      capturedOnOpen?.();
    });

    expect(latest!.status).toBe("connected");
  });

  it("returns to connected when the session reopens after an error", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });
    act(() => {
      capturedOnOpen?.();
    });
    expect(latest!.status).toBe("connected");

    act(() => {
      capturedOnError?.(new Event("error"));
    });
    expect(latest!.status).toBe("reconnecting");

    // The client reconnects internally on a fresh EventSource and reports that
    // open. Status must recover here rather than waiting for the next event.
    act(() => {
      capturedOnOpen?.();
    });

    expect(latest!.status).toBe("connected");
  });

  it("transitions to connected status when an event is received", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    // Simulate receiving an SSE event
    act(() => {
      capturedOnEvent?.({ event: "messages_updated", data: { channelId: "ch1", count: 5 } });
    });

    expect(latest!.status).toBe("connected");
    expect(onEvent).toHaveBeenCalledWith({ event: "messages_updated", data: { channelId: "ch1", count: 5 } });
  });

  it("dispatches events to the onEvent callback", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    act(() => {
      capturedOnEvent?.({ event: "analysis_started", data: { batchId: "b1", taskId: "t1" } });
    });
    act(() => {
      capturedOnEvent?.({ event: "collector_status_changed", data: { status: "running" } });
    });

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenCalledWith({ event: "analysis_started", data: { batchId: "b1", taskId: "t1" } });
    expect(onEvent).toHaveBeenCalledWith({ event: "collector_status_changed", data: { status: "running" } });
  });

  it("transitions to reconnecting status on error", () => {
    const onEvent = vi.fn();
    const onError = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent, onError }} />);
    });

    // Simulate connection error
    const errorEvent = new Event("error");
    act(() => {
      capturedOnError?.(errorEvent);
    });

    expect(latest!.status).toBe("reconnecting");
    expect(onError).toHaveBeenCalledWith(errorEvent);
  });

  it("disconnects when disconnect() is called and closes EventSource", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    act(() => {
      latest!.disconnect();
    });

    expect(mockConnection.close).toHaveBeenCalled();
    expect(latest!.status).toBe("disconnected");
  });

  it("does not set reconnecting status after manual disconnect", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    act(() => {
      latest!.disconnect();
    });

    // Simulate an error event arriving after disconnect
    act(() => {
      capturedOnError?.(new Event("error"));
    });

    // Status should remain disconnected, not switch to reconnecting
    expect(latest!.status).toBe("disconnected");
  });

  it("reconnects when reconnect() is called", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    act(() => {
      latest!.disconnect();
    });

    mockConnectSSE.mockClear();

    act(() => {
      latest!.reconnect();
    });

    expect(mockConnectSSE).toHaveBeenCalledTimes(1);
    expect(latest!.status).toBe("connecting");
  });

  it("does not connect when enabled is false", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent, enabled: false }} />);
    });

    expect(mockConnectSSE).not.toHaveBeenCalled();
    expect(latest!.status).toBe("disconnected");
  });

  it("disconnects when enabled changes from true to false", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent, enabled: true }} />);
    });

    expect(mockConnectSSE).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(<Harness options={{ onEvent, enabled: false }} />);
    });

    expect(mockConnection.close).toHaveBeenCalled();
    expect(latest!.status).toBe("disconnected");
  });

  it("cleans up EventSource on unmount", () => {
    const onEvent = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent }} />);
    });

    act(() => {
      root.unmount();
    });

    expect(mockConnection.close).toHaveBeenCalled();
  });

  it("updates onEvent callback without reconnecting", () => {
    const onEvent1 = vi.fn();
    const onEvent2 = vi.fn();

    act(() => {
      root.render(<Harness options={{ onEvent: onEvent1 }} />);
    });

    const firstCallCount = mockConnectSSE.mock.calls.length;

    // Re-render with new onEvent callback
    act(() => {
      root.render(<Harness options={{ onEvent: onEvent2 }} />);
    });

    // Should NOT have reconnected
    expect(mockConnectSSE.mock.calls.length).toBe(firstCallCount);

    // New callback should be used for events
    act(() => {
      capturedOnEvent?.({ event: "messages_updated", data: {} });
    });

    expect(onEvent1).not.toHaveBeenCalled();
    expect(onEvent2).toHaveBeenCalledTimes(1);
  });
});
