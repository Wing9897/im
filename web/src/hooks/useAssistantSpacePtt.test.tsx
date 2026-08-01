import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useAssistantSpacePtt } from "./useAssistantSpacePtt";

function Harness(props: {
  enabled?: boolean;
  listening?: boolean;
  mode: "hold" | "toggle";
  startListening: () => void;
  stopListening: (options?: { send?: boolean }) => void;
  onHoldChange?: (held: boolean) => void;
}) {
  useAssistantSpacePtt({
    enabled: props.enabled ?? true,
    sttAvailable: true,
    sending: false,
    listening: props.listening ?? false,
    startListening: props.startListening,
    stopListening: props.stopListening,
    mode: props.mode,
    onHoldChange: props.onHoldChange,
  });
  return createElement("div", { "data-testid": "ptt-harness" });
}

describe("useAssistantSpacePtt", () => {
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

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function dispatch(type: "keydown" | "keyup", code = "Space") {
    const event = new KeyboardEvent(type, {
      bubbles: true,
      cancelable: true,
      key: " ",
      code,
    });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it("hold mode starts on keydown and stops on keyup", () => {
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "hold",
          startListening,
          stopListening,
        }),
      );
    });
    dispatch("keydown");
    expect(startListening).toHaveBeenCalledTimes(1);
    dispatch("keyup");
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("toggle mode starts on first Space and stops on second while listening", () => {
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "toggle",
          listening: false,
          startListening,
          stopListening,
        }),
      );
    });
    dispatch("keydown");
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(stopListening).not.toHaveBeenCalled();

    act(() => {
      root.render(
        createElement(Harness, {
          mode: "toggle",
          listening: true,
          startListening,
          stopListening,
        }),
      );
    });
    dispatch("keydown");
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("hold mode notifies onHoldChange immediately", () => {
    const onHoldChange = vi.fn();
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "hold",
          startListening,
          stopListening,
          onHoldChange,
        }),
      );
    });
    dispatch("keydown");
    expect(onHoldChange).toHaveBeenCalledWith(true);
    dispatch("keyup");
    expect(onHoldChange).toHaveBeenCalledWith(false);
  });

  it("hold mode: changing start/stop identity mid-hold does not teardown-stop", () => {
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "hold",
          startListening,
          stopListening,
        }),
      );
    });
    dispatch("keydown");
    expect(startListening).toHaveBeenCalledTimes(1);

    const start2 = vi.fn();
    const stop2 = vi.fn();
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "hold",
          startListening: start2,
          stopListening: stop2,
        }),
      );
    });
    // Refs keep the same effect; cleanup must not fire stop on identity churn.
    expect(stopListening).not.toHaveBeenCalled();
    expect(stop2).not.toHaveBeenCalled();

    dispatch("keyup");
    expect(stop2).toHaveBeenCalledWith({ send: true });
  });

  it("does not start Space PTT while an editable is focused", () => {
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "hold",
          startListening,
          stopListening,
        }),
      );
      textarea.focus();
    });
    dispatch("keydown");
    expect(startListening).not.toHaveBeenCalled();
    textarea.remove();
  });

  it("focusing editable stops Space-owned listen without send", () => {
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "toggle",
          listening: false,
          startListening,
          stopListening,
        }),
      );
    });
    dispatch("keydown");
    expect(startListening).toHaveBeenCalledTimes(1);

    act(() => {
      root.render(
        createElement(Harness, {
          mode: "toggle",
          listening: true,
          startListening,
          stopListening,
        }),
      );
    });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    act(() => {
      textarea.focus();
    });
    expect(stopListening).toHaveBeenCalledWith();
    expect(stopListening).not.toHaveBeenCalledWith({ send: true });
    textarea.remove();
  });

  it("focusing editable does not stop mic-owned listening", () => {
    // Mic already listening; Space never started this session.
    act(() => {
      root.render(
        createElement(Harness, {
          mode: "toggle",
          listening: true,
          startListening,
          stopListening,
        }),
      );
    });

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    act(() => {
      textarea.focus();
    });
    expect(stopListening).not.toHaveBeenCalled();
    textarea.remove();
  });
});
