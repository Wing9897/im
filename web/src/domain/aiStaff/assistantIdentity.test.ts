import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_IDENTITY_KEY,
  DEFAULT_ASSISTANT_IDENTITY,
  hydrateAssistantIdentityFromServer,
  identityFromSettings,
  identityToSettingsPatch,
  readAssistantIdentity,
  resolveAssistantDisplayName,
  writeAssistantIdentity,
} from "./assistantIdentity";

const fetchSystemSettings = vi.fn();
const saveSystemSettings = vi.fn();

vi.mock("../../api/config", () => ({
  fetchSystemSettings: (...args: unknown[]) => fetchSystemSettings(...args),
  saveSystemSettings: (...args: unknown[]) => saveSystemSettings(...args),
}));

describe("assistantIdentity", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchSystemSettings.mockReset();
    saveSystemSettings.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when storage is empty or corrupt", () => {
    expect(readAssistantIdentity()).toEqual(DEFAULT_ASSISTANT_IDENTITY);
    window.localStorage.setItem(ASSISTANT_IDENTITY_KEY, "{not-json");
    expect(readAssistantIdentity()).toEqual(DEFAULT_ASSISTANT_IDENTITY);
    window.localStorage.setItem(ASSISTANT_IDENTITY_KEY, JSON.stringify({ displayName: 1 }));
    expect(readAssistantIdentity()).toEqual(DEFAULT_ASSISTANT_IDENTITY);
  });

  it("round-trips displayName and avatarDataUrl in local cache", () => {
    writeAssistantIdentity({
      displayName: "阿助",
      avatarDataUrl: "data:image/jpeg;base64,abc",
    });
    expect(readAssistantIdentity()).toEqual({
      displayName: "阿助",
      avatarDataUrl: "data:image/jpeg;base64,abc",
    });
  });

  it("maps settings snapshot fields", () => {
    expect(
      identityFromSettings({
        assistantDisplayName: "  Helix  ",
        assistantAvatar: "data:image/jpeg;base64,x",
      }),
    ).toEqual({ displayName: "Helix", avatarDataUrl: "data:image/jpeg;base64,x" });
    expect(identityToSettingsPatch({ displayName: "A", avatarDataUrl: null })).toEqual({
      assistantDisplayName: "A",
      assistantAvatar: "",
    });
  });

  it("falls back when display name is blank", () => {
    expect(
      resolveAssistantDisplayName({ displayName: "  ", avatarDataUrl: null }, "助手"),
    ).toBe("助手");
    expect(
      resolveAssistantDisplayName({ displayName: "自定义", avatarDataUrl: null }, "助手"),
    ).toBe("自定义");
  });

  it("hydrates from server without migrating local cache when server empty", async () => {
    writeAssistantIdentity({
      displayName: "本機名",
      avatarDataUrl: "data:image/jpeg;base64,local",
    });
    fetchSystemSettings.mockResolvedValue({
      assistantDisplayName: "",
      assistantAvatar: "",
    });

    const identity = await hydrateAssistantIdentityFromServer();
    expect(saveSystemSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ assistantDisplayName: "本機名" }),
    );
    expect(identity).toEqual(DEFAULT_ASSISTANT_IDENTITY);
    expect(readAssistantIdentity()).toEqual(DEFAULT_ASSISTANT_IDENTITY);
  });

  it("prefers server identity over local cache", async () => {
    writeAssistantIdentity({ displayName: "本機", avatarDataUrl: null });
    fetchSystemSettings.mockResolvedValue({
      assistantDisplayName: "伺服器",
      assistantAvatar: "",
    });
    saveSystemSettings.mockClear();

    const identity = await hydrateAssistantIdentityFromServer();
    expect(saveSystemSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ assistantDisplayName: "本機" }),
    );
    expect(identity.displayName).toBe("伺服器");
    expect(readAssistantIdentity().displayName).toBe("伺服器");
  });
});

describe("compressAvatarToDataUrl", () => {
  it("compresses a canvas-backed blob under the size cap", async () => {
    const { compressAvatarToDataUrl, AVATAR_MAX_DATA_URL_CHARS } = await import(
      "./assistantIdentity"
    );

    if (typeof createImageBitmap !== "function") {
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof canvas.toDataURL !== "function") {
      return;
    }
    ctx.fillStyle = "#336699";
    ctx.fillRect(0, 0, 64, 64);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/png");
    });
    if (!blob) {
      return;
    }

    const file = new File([blob], "avatar.png", { type: "image/png" });
    const dataUrl = await compressAvatarToDataUrl(file);
    expect(dataUrl.startsWith("data:image/jpeg")).toBe(true);
    expect(dataUrl.length).toBeLessThanOrEqual(AVATAR_MAX_DATA_URL_CHARS);
  });

  it("rejects when createImageBitmap fails", async () => {
    const { compressAvatarToDataUrl } = await import("./assistantIdentity");
    const original = globalThis.createImageBitmap;
    globalThis.createImageBitmap = vi.fn(async () => {
      throw new Error("bad");
    }) as typeof createImageBitmap;
    try {
      const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
      await expect(compressAvatarToDataUrl(file)).rejects.toThrow("read_failed");
    } finally {
      globalThis.createImageBitmap = original;
    }
  });
});
