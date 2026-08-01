import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_USER_PROFILE,
  USER_PROFILE_KEY,
  hydrateUserProfileFromServer,
  profileFromSettings,
  profileToSettingsPatch,
  readUserProfile,
  resolveUserDisplayName,
  writeUserProfile,
} from "./userProfile";

const fetchSystemSettings = vi.fn();
const saveSystemSettings = vi.fn();

vi.mock("../../api/config", () => ({
  fetchSystemSettings: (...args: unknown[]) => fetchSystemSettings(...args),
  saveSystemSettings: (...args: unknown[]) => saveSystemSettings(...args),
}));

describe("userProfile", () => {
  beforeEach(() => {
    window.localStorage.clear();
    fetchSystemSettings.mockReset();
    saveSystemSettings.mockReset();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns defaults when storage is empty or corrupt", () => {
    expect(readUserProfile()).toEqual(DEFAULT_USER_PROFILE);
    window.localStorage.setItem(USER_PROFILE_KEY, "{not-json");
    expect(readUserProfile()).toEqual(DEFAULT_USER_PROFILE);
    window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify({ displayName: 1 }));
    expect(readUserProfile()).toEqual(DEFAULT_USER_PROFILE);
  });

  it("round-trips displayName, avatarDataUrl, and background in local cache", () => {
    writeUserProfile({
      displayName: "Wing",
      avatarDataUrl: "data:image/jpeg;base64,abc",
      background: "Ops lead",
    });
    expect(readUserProfile()).toEqual({
      displayName: "Wing",
      avatarDataUrl: "data:image/jpeg;base64,abc",
      background: "Ops lead",
    });
  });

  it("maps settings snapshot fields", () => {
    expect(
      profileFromSettings({
        userDisplayName: "  Wing  ",
        userAvatar: "data:image/jpeg;base64,x",
        userBackground: "Bio",
      }),
    ).toEqual({
      displayName: "Wing",
      avatarDataUrl: "data:image/jpeg;base64,x",
      background: "Bio",
    });
    expect(
      profileToSettingsPatch({ displayName: "A", avatarDataUrl: null, background: "B" }),
    ).toEqual({
      userDisplayName: "A",
      userAvatar: "",
      userBackground: "B",
    });
  });

  it("falls back when display name is blank", () => {
    expect(
      resolveUserDisplayName(
        { displayName: "  ", avatarDataUrl: null, background: "" },
        "用戶",
      ),
    ).toBe("用戶");
    expect(
      resolveUserDisplayName(
        { displayName: "自定义", avatarDataUrl: null, background: "" },
        "用戶",
      ),
    ).toBe("自定义");
  });

  it("hydrates from server without migrating local cache when server empty", async () => {
    writeUserProfile({
      displayName: "本機名",
      avatarDataUrl: "data:image/jpeg;base64,local",
      background: "本地背景",
    });
    fetchSystemSettings.mockResolvedValue({
      userDisplayName: "",
      userAvatar: "",
      userBackground: "",
    });

    const profile = await hydrateUserProfileFromServer();
    expect(saveSystemSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ userDisplayName: "本機名" }),
    );
    expect(profile).toEqual(DEFAULT_USER_PROFILE);
    expect(readUserProfile()).toEqual(DEFAULT_USER_PROFILE);
  });

  it("prefers server profile over local cache", async () => {
    writeUserProfile({ displayName: "本機", avatarDataUrl: null, background: "" });
    fetchSystemSettings.mockResolvedValue({
      userDisplayName: "伺服器",
      userAvatar: "",
      userBackground: "伺服器背景",
    });
    saveSystemSettings.mockClear();

    const profile = await hydrateUserProfileFromServer();
    expect(saveSystemSettings).not.toHaveBeenCalledWith(
      expect.objectContaining({ userDisplayName: "本機" }),
    );
    expect(profile.displayName).toBe("伺服器");
    expect(readUserProfile().displayName).toBe("伺服器");
    expect(readUserProfile().background).toBe("伺服器背景");
  });
});
