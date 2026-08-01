import { describe, it, expect, vi } from "vitest";
import {
  applyPttToggle,
  beginPttHold,
  endPttHold,
  stopPttForEditable,
} from "./pttInteraction";
import { takeHeardTextForSend } from "./voiceReleaseSend";

describe("pttInteraction", () => {
  it("toggle: starts when idle, stops+sends when listening", () => {
    const startListening = vi.fn();
    const stopListening = vi.fn();
    applyPttToggle(false, false, { startListening, stopListening });
    expect(startListening).toHaveBeenCalledTimes(1);
    expect(stopListening).not.toHaveBeenCalled();

    applyPttToggle(true, false, { startListening, stopListening });
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("toggle: ignores presses while sending", () => {
    const startListening = vi.fn();
    const stopListening = vi.fn();
    applyPttToggle(false, true, { startListening, stopListening });
    expect(startListening).not.toHaveBeenCalled();
    expect(stopListening).not.toHaveBeenCalled();
  });

  it("hold begin/end is idempotent via held flag", () => {
    const startListening = vi.fn();
    const stopListening = vi.fn();
    expect(beginPttHold(false, false, { startListening })).toBe(true);
    expect(beginPttHold(false, true, { startListening })).toBe(false);
    expect(startListening).toHaveBeenCalledTimes(1);

    expect(endPttHold(true, { stopListening })).toBe(true);
    expect(endPttHold(false, { stopListening })).toBe(false);
    expect(stopListening).toHaveBeenCalledTimes(1);
    expect(stopListening).toHaveBeenCalledWith({ send: true });
  });

  it("editable focus stops without send", () => {
    const stopListening = vi.fn();
    stopPttForEditable(true, { stopListening });
    expect(stopListening).toHaveBeenCalledWith();
    stopPttForEditable(false, { stopListening });
    expect(stopListening).toHaveBeenCalledTimes(1);
  });
});

describe("takeHeardTextForSend", () => {
  it("returns null for empty / whitespace STT", () => {
    expect(takeHeardTextForSend("")).toBeNull();
    expect(takeHeardTextForSend("   ")).toBeNull();
  });

  it("returns trimmed STT text", () => {
    expect(takeHeardTextForSend("  hello  ")).toBe("hello");
  });
});
