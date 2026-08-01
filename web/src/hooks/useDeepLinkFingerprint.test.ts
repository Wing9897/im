import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  useDeepLinkFingerprint,
  type DeepLinkGate,
} from "./useDeepLinkFingerprint";

function Harness({
  onReady,
}: {
  onReady: (gate: (key: string, payload: string | null) => DeepLinkGate) => void;
}) {
  const gate = useDeepLinkFingerprint();
  onReady(gate);
  return null;
}

describe("useDeepLinkFingerprint", () => {
  let container: HTMLDivElement;
  let root: Root;
  let gate: ((key: string, payload: string | null) => DeepLinkGate) | null = null;

  beforeEach(() => {
    gate = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        createElement(Harness, {
          onReady: (fn) => {
            gate = fn;
          },
        }),
      );
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("applies once per location.key + payload, then skips", () => {
    expect(gate!("k1", "id=1")).toBe("apply");
    expect(gate!("k1", "id=1")).toBe("skip");
  });

  it("re-applies when location.key changes", () => {
    expect(gate!("k1", "id=1")).toBe("apply");
    expect(gate!("k2", "id=1")).toBe("apply");
  });

  it("clears latch when payload is null so the same signal can apply again", () => {
    expect(gate!("k1", "id=1")).toBe("apply");
    expect(gate!("k1", null)).toBe("clear");
    expect(gate!("k1", "id=1")).toBe("apply");
  });
});
