/**
 * Unit tests for setup API client layering:
 * public endpoints → publicFetch; authed → apiClient (401 refresh).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./client";
import { publicFetchJson } from "./publicFetch";
import {
  changePassword,
  fetchSetupDevices,
  fetchSetupStatus,
  loginWithPassword,
  logoutDeviceSession,
  registerAdmin,
  resetPassword,
  revokeSetupDevice,
} from "./setup";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("./publicFetch", () => ({
  publicFetchJson: vi.fn(),
}));

vi.mock("../domain/connection/connectionStore", () => ({
  saveDeviceSession: vi.fn(),
  getAccessToken: vi.fn(),
}));

describe("setup API layering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchSetupStatus uses publicFetch", async () => {
    vi.mocked(publicFetchJson).mockResolvedValue({
      bootstrapped: true,
      hasAdmin: true,
      hasActiveDevice: true,
      credentialsConfigured: true,
      localhostAuthExempt: false,
      resetPasswordForLocal: false,
    });

    await fetchSetupStatus();

    expect(publicFetchJson).toHaveBeenCalledWith("/api/v1/setup/status", { baseUrl: undefined });
    expect(apiClient.get).not.toHaveBeenCalled();
  });

  it("registerAdmin uses publicFetch", async () => {
    vi.mocked(publicFetchJson).mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      accessExpiresAt: "t1",
      refreshExpiresAt: "t2",
      device: {
        id: "d1",
        label: "Host",
        createdAt: "t",
        lastSeenAt: "t",
        expiresAt: "t",
      },
    });

    await registerAdmin("admin", "password1", "Host");

    expect(publicFetchJson).toHaveBeenCalledWith("/api/v1/setup/register", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1", label: "Host" }),
      baseUrl: undefined,
    });
  });

  it("loginWithPassword uses publicFetch", async () => {
    vi.mocked(publicFetchJson).mockResolvedValue({
      accessToken: "a",
      refreshToken: "r",
      accessExpiresAt: "t1",
      refreshExpiresAt: "t2",
      device: {
        id: "d1",
        label: "Phone",
        createdAt: "t",
        lastSeenAt: "t",
        expiresAt: "t",
      },
    });

    await loginWithPassword("admin", "password1", "Phone");

    expect(publicFetchJson).toHaveBeenCalledWith("/api/v1/setup/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "password1", label: "Phone" }),
      baseUrl: undefined,
    });
  });

  it("changePassword uses apiClient", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ ok: true });

    await changePassword("password1", "password2");

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/setup/change-password", {
      currentPassword: "password1",
      newPassword: "password2",
    });
  });

  it("resetPassword uses publicFetch", async () => {
    vi.mocked(publicFetchJson).mockResolvedValue({ ok: true });

    await resetPassword("admin", "password9");

    expect(publicFetchJson).toHaveBeenCalledWith("/api/v1/setup/reset-password", {
      method: "POST",
      body: JSON.stringify({ username: "admin", newPassword: "password9" }),
      baseUrl: undefined,
    });
  });

  it("logoutDeviceSession uses apiClient", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ ok: true });

    await logoutDeviceSession();

    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/setup/logout");
  });

  it("fetchSetupDevices uses apiClient", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ devices: [] });

    await fetchSetupDevices();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/setup/devices");
  });

  it("revokeSetupDevice uses apiClient delete", async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ ok: true });

    await revokeSetupDevice("dev-1");

    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/setup/devices/dev-1");
  });
});
