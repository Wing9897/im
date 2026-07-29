import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveDeviceSession } from "../domain/connection/connectionStore";
import { publicFetchJson } from "./publicFetch";
import { refreshDeviceSession } from "./setupSession";

vi.mock("../domain/connection/connectionStore", () => ({
  saveDeviceSession: vi.fn(),
}));

vi.mock("./publicFetch", () => ({
  publicFetchJson: vi.fn(),
}));

describe("setupSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refreshes publicly and saves the rotated device session", async () => {
    const response = {
      accessToken: "new-access",
      refreshToken: "new-refresh",
      accessExpiresAt: "2030-01-01T00:00:00Z",
      refreshExpiresAt: "2030-02-01T00:00:00Z",
      device: {
        id: "device-1",
        label: "Browser",
        createdAt: "2029-01-01T00:00:00Z",
        lastSeenAt: "2029-01-02T00:00:00Z",
        expiresAt: "2030-02-01T00:00:00Z",
      },
    };
    vi.mocked(publicFetchJson).mockResolvedValue(response);

    await expect(refreshDeviceSession("old-refresh")).resolves.toEqual(response);

    expect(publicFetchJson).toHaveBeenCalledWith("/api/v1/setup/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: "old-refresh" }),
      baseUrl: undefined,
    });
    expect(saveDeviceSession).toHaveBeenCalledWith({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      accessExpiresAt: "2030-01-01T00:00:00Z",
      refreshExpiresAt: "2030-02-01T00:00:00Z",
      deviceId: "device-1",
      deviceLabel: "Browser",
    });
  });
});
