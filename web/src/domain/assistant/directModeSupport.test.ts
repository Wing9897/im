import { describe, it, expect, vi, beforeEach } from "vitest";

const isElectronDesktop = vi.hoisted(() => vi.fn(() => false));

vi.mock("../../electron/electronWindow", () => ({
  isElectronDesktop: () => isElectronDesktop(),
}));

import { isAssistantDirectModeSupported } from "./directModeSupport";

describe("isAssistantDirectModeSupported", () => {
  beforeEach(() => {
    isElectronDesktop.mockReturnValue(false);
  });

  it("allows voice PTT capability in the browser shell", () => {
    expect(isAssistantDirectModeSupported()).toBe(true);
  });

  it("blocks voice PTT on desktop until a local STT adapter is wired", () => {
    isElectronDesktop.mockReturnValue(true);
    expect(isAssistantDirectModeSupported()).toBe(false);
  });
});
