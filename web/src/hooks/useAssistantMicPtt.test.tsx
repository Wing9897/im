import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAssistantMicPtt } from "./useAssistantMicPtt";
import type { SpacePttMode } from "../speech/voiceSettings";

function MicHarness(props: {
  spacePttMode: SpacePttMode;
  listening?: boolean;
  sending?: boolean;
  startListening: () => void;
  stopListening: (options?: { send?: boolean }) => void;
  captureFiresLost?: boolean;
}) {
  const [listening] = useState(props.listening ?? false);
  const { onMicPointerDown, onMicPointerUp, onMicClick } = useAssistantMicPtt({
    spacePttMode: props.spacePttMode,
    listening,
    sending: props.sending ?? false,
    startListening: props.startListening,
    stopListening: props.stopListening,
  });

  return createElement("button", {
    type: "button",
    "data-testid": "mic",
    onPointerDown: onMicPointerDown,
    onPointerUp: onMicPointerUp,
    // Intentionally no onPointerCancel / onLostPointerCapture — must not end hold.
    onClick: onMicClick,
  });
}

describe("useAssistantMicPtt", () => {
  let container: HTMLDivElement;
  let root: Root;
  const startListening = vi.fn();
  const stopListening = vi.fn();

  beforeEach(() => {
    startListening.mockClear();
    stopListening.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  function render(
    mode: SpacePttMode,
    extra?: { listening?: boolean; sending?: boolean; captureFiresLost?: boolean },
  ) {
    act(() => {
      root.render(
        createElement(MicHarness, {
          spacePttMode: mode,
          listening: extra?.listening,
          sending: extra?.sending,
          startListening,
          stopListening,
          captureFiresLost: extra?.captureFiresLost,
        }),
      );
    });
    const mic = container.querySelector('[data-testid="mic"]') as HTMLButtonElement;
    mic.setPointerCapture = (pointerId: number) => {
      if (extra?.captureFiresLost) {
        const lost = new Event("lostpointercapture", { bubbles: true });
        Object.defineProperty(lost, "pointerId", { value: pointerId });
        mic.dispatchEvent(lost);
      }
    };
    mic.releasePointerCapture = () => {};
    mic.hasPointerCapture = () => true;
    return mic;
  }

  function pointer(
    el: HTMLElement,
    type: "pointerdown" | "pointerup" | "pointercancel",
    pointerId = 1,
  ) {
    act(() => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(event, "pointerId", { value: pointerId });
      el.dispatchEvent(event);
    });
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("hold mode: short pointerdown+pointerup starts then stops (no stuck listen)", () => {
    const mic = render("hold");
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);

    pointer(mic, "pointerup");
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode starts on pointerdown and stops once despite lostpointercapture", () => {
    const mic = render("hold");
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);

    pointer(mic, "pointerup");
    act(() => {
      mic.dispatchEvent(new Event("lostpointercapture", { bubbles: true }));
    });

    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode: lostpointercapture from label reflow does not end the press (git regression)", () => {
    const mic = render("hold", { captureFiresLost: true });
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);
    // Pre-fix / old behavior ended here; that aborted real holds.
    expect(stopListening).not.toHaveBeenCalled();

    pointer(mic, "pointerup");
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode: pointercancel does not end the press", () => {
    const mic = render("hold");
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);

    pointer(mic, "pointercancel");
    expect(stopListening).not.toHaveBeenCalled();

    pointer(mic, "pointerup");
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode: window pointerup ends press when button-local up is missed", () => {
    const mic = render("hold");
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);

    act(() => {
      const event = new MouseEvent("pointerup", { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(event, "pointerId", { value: 1 });
      window.dispatchEvent(event);
    });

    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode: window pointercancel does not end the press", () => {
    const mic = render("hold");
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);

    act(() => {
      const event = new MouseEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
        button: 0,
      });
      Object.defineProperty(event, "pointerId", { value: 1 });
      window.dispatchEvent(event);
    });

    expect(stopListening).not.toHaveBeenCalled();

    act(() => {
      const event = new MouseEvent("pointerup", { bubbles: true, cancelable: true, button: 0 });
      Object.defineProperty(event, "pointerId", { value: 1 });
      window.dispatchEvent(event);
    });

    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode: pointerdown while stuck held recovers then restarts", () => {
    const mic = render("hold");
    pointer(mic, "pointerdown");
    expect(startListening).toHaveBeenCalledTimes(1);

    // Simulate stuck hold (cancel ignored, no pointerup) — next down recovers.
    pointer(mic, "pointerdown", 2);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
    expect(startListening).toHaveBeenCalledTimes(2);

    pointer(mic, "pointerup", 2);
    expect(stopListening).toHaveBeenCalledTimes(2);
  });

  it("hold mode ignores pointerup without an active press", () => {
    const mic = render("hold");
    pointer(mic, "pointerup");
    expect(stopListening).not.toHaveBeenCalled();
  });

  it("toggle mode: first click starts, second click stops; pointer hold ignored", () => {
    const mic = render("toggle", { listening: false });
    pointer(mic, "pointerdown");
    pointer(mic, "pointerup");
    expect(startListening).not.toHaveBeenCalled();
    expect(stopListening).not.toHaveBeenCalled();

    act(() => {
      mic.click();
    });
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(stopListening).not.toHaveBeenCalled();
  });

  it("toggle mode: click while listening stops and sends", () => {
    const mic = render("toggle", { listening: true });
    act(() => {
      mic.click();
    });
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
    expect(startListening).not.toHaveBeenCalled();
  });
});
