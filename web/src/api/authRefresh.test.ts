import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDeviceSession,
  getConnectionSnapshot,
  getRefreshToken,
} from "../domain/connection/connectionStore";
import { refreshDeviceSession } from "./setupSession";
import {
  _resetAuthRefreshForTests,
  isSetupAuthPath,
  isStoredAccessExpired,
  refreshAccessTokenOnce,
} from "./authRefresh";

vi.mock("../domain/connection/connectionStore", () => ({
  clearDeviceSession: vi.fn(),
  getConnectionSnapshot: vi.fn(),
  getRefreshToken: vi.fn(),
}));

vi.mock("./setupSession", () => ({
  refreshDeviceSession: vi.fn(),
}));

describe("authRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetAuthRefreshForTests();
    vi.mocked(getConnectionSnapshot).mockReturnValue({
      accessExpiresAt: null,
    } as ReturnType<typeof getConnectionSnapshot>);
  });

  it("shares one refresh request across concurrent callers", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("refresh-1");
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    vi.mocked(refreshDeviceSession).mockImplementation(async () => {
      await pending;
      return {
        accessToken: "access-2",
        refreshToken: "refresh-2",
        accessExpiresAt: "",
        refreshExpiresAt: "",
        device: {
          id: "device-1",
          label: "Browser",
          createdAt: "",
          lastSeenAt: "",
          expiresAt: "",
        },
      };
    });

    const first = refreshAccessTokenOnce();
    const second = refreshAccessTokenOnce();

    expect(refreshDeviceSession).toHaveBeenCalledOnce();
    expect(refreshDeviceSession).toHaveBeenCalledWith("refresh-1");
    finish();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(clearDeviceSession).not.toHaveBeenCalled();
  });

  it("clears the stored session when refresh fails", async () => {
    vi.mocked(getRefreshToken).mockReturnValue("expired-refresh");
    vi.mocked(refreshDeviceSession).mockRejectedValue(new Error("unauthorized"));

    await expect(refreshAccessTokenOnce()).resolves.toBe(false);

    expect(clearDeviceSession).toHaveBeenCalledOnce();
  });

  it("does not start refresh without a refresh token", async () => {
    vi.mocked(getRefreshToken).mockReturnValue(undefined);

    await expect(refreshAccessTokenOnce()).resolves.toBe(false);

    expect(refreshDeviceSession).not.toHaveBeenCalled();
    expect(clearDeviceSession).not.toHaveBeenCalled();
  });

  it("recognizes public auth paths and stored expiry", () => {
    expect(isSetupAuthPath("http://localhost/api/v1/setup/refresh")).toBe(true);
    expect(isSetupAuthPath("http://localhost/api/v1/tasks")).toBe(false);

    vi.mocked(getConnectionSnapshot).mockReturnValue({
      accessExpiresAt: "2000-01-01T00:00:00Z",
    } as ReturnType<typeof getConnectionSnapshot>);
    expect(isStoredAccessExpired()).toBe(true);
  });
});
