/**
 * Unit tests for src/api/sources/
 * Covers success and error paths for all public API functions.
 *
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { apiClient } from "./client";
import {
  listSources,
  listTelegramSources,
  deleteSource,
  reconnectSource,
  refreshAllSources,
  createTelegramSource,
  updateTelegramSource,
  submitTelegramCode,
  submitTelegram2fa,
  createDiscordBot,
  updateDiscordBot,
  subscribeDiscordChannels,
  listDiscordBots,
  createMqttBroker,
  createRssFeed,
  listRssFeeds,
  createEmailMailbox,
  updateEmailMailbox,
  listEmailMailboxes,
  listMqttBrokers,
} from "./sources";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("sources API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── listSources ───────────────────────────────────────────────────

  describe("listSources", () => {
    it("fetches all sources without platform filter", async () => {
      const sources = [{ id: "1", platform: "telegram" }];
      vi.mocked(apiClient.get).mockResolvedValue(sources);

      const result = await listSources();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sources");
      expect(result).toEqual(sources);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Network error"));

      await expect(listSources()).rejects.toThrow("Network error");
    });
  });

  describe("listTelegramSources", () => {
    it("fetches typed telegram alias", async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      await listTelegramSources();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sources/telegram");
    });
  });

  describe("updateTelegramSource", () => {
    it("patches telegram source display name", async () => {
      const response = {
        source: { id: "acc-1", platform: "telegram", name: "Ops" },
        status: "connected",
        errorMessage: null,
        credentialsUpdated: false,
      };
      vi.mocked(apiClient.patch).mockResolvedValue(response);

      const result = await updateTelegramSource("acc-1", { name: "Ops" });

      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/sources/telegram/acc-1", {
        name: "Ops",
      });
      expect(result).toEqual(response);
    });
  });

  describe("updateDiscordBot", () => {
    it("patches discord bot name/token", async () => {
      const response = {
        source: { id: "acc-dc", platform: "discord", name: "Bot" },
        channels: [],
        status: "connected",
        errorMessage: null,
      };
      vi.mocked(apiClient.patch).mockResolvedValue(response);

      const result = await updateDiscordBot("acc-dc", { name: "Bot", botToken: "tok" });

      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/sources/discord/acc-dc", {
        name: "Bot",
        botToken: "tok",
      });
      expect(result).toEqual(response);
    });
  });

  // ─── deleteSource ──────────────────────────────────────────────────

  describe("deleteSource", () => {
    it("deletes source by ID", async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined);

      await deleteSource("acc-123");

      expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/sources/acc-123");
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error("Not found"));

      await expect(deleteSource("bad-id")).rejects.toThrow("Not found");
    });
  });

  // ─── reconnectSource ───────────────────────────────────────────────

  describe("reconnectSource", () => {
    it("posts reconnect request and returns AddSourceResponse", async () => {
      const response = {
        source: {
          id: "acc-1",
          platform: "discord",
          name: "Bot",
          status: "connected",
          lastError: null,
          lastConnectedAt: "2026-01-01T00:00:00.000Z",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        nextStep: "connected" as const,
      };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await reconnectSource("acc-1");

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/acc-1/reconnect");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Timeout"));

      await expect(reconnectSource("acc-1")).rejects.toThrow("Timeout");
    });
  });

  // ─── refreshAllSources ─────────────────────────────────────────────

  describe("refreshAllSources", () => {
    it("posts refresh-all request and returns RefreshAllSourcesResponse", async () => {
      const response = {
        totalSources: 5,
        connectedCount: 3,
        verificationRequiredCount: 1,
        errorCount: 1,
        verificationRequiredSourceIds: ["tg-1"],
        errorSourceIds: ["dc-1"],
      };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await refreshAllSources();

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/refresh-all");
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Server error"));

      await expect(refreshAllSources()).rejects.toThrow("Server error");
    });
  });

  // ─── createTelegramSource ──────────────────────────────────────────

  describe("createTelegramSource", () => {
    it("posts credentials and returns response", async () => {
      const credentials = { phone: "+1234567890", apiId: "123", apiHash: "abc" };
      const response = { sourceId: "tg-1", status: "code_required" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createTelegramSource(credentials as any);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/telegram", credentials);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Invalid credentials"));

      await expect(createTelegramSource({} as any)).rejects.toThrow("Invalid credentials");
    });
  });

  // ─── submitTelegramCode ─────────────────────────────────────────────

  describe("submitTelegramCode", () => {
    it("posts verification code and returns response", async () => {
      const params = { code: "12345", pendingLoginStage: "code_required" as const };
      const response = { sourceId: "tg-1", status: "connected" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await submitTelegramCode("tg-1", params);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/sources/telegram/tg-1/verify-code",
        params,
      );
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Invalid code"));

      await expect(submitTelegramCode("tg-1", { code: "000" })).rejects.toThrow("Invalid code");
    });
  });

  // ─── submitTelegram2fa ──────────────────────────────────────────────

  describe("submitTelegram2fa", () => {
    it("posts 2FA password and returns response", async () => {
      const params = { password: "secret", pendingLoginStage: "2fa_required" as const };
      const response = { sourceId: "tg-1", status: "connected" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await submitTelegram2fa("tg-1", params);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/sources/telegram/tg-1/verify-2fa",
        params,
      );
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Wrong password"));

      await expect(submitTelegram2fa("tg-1", { password: "bad" })).rejects.toThrow("Wrong password");
    });
  });

  // ─── createDiscordBot ───────────────────────────────────────────────

  describe("createDiscordBot", () => {
    it("posts bot token and returns response", async () => {
      const response = { sourceId: "dc-1", botName: "TestBot" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createDiscordBot({ botToken: "token-abc" });

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/discord", { botToken: "token-abc" });
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Invalid token"));

      await expect(createDiscordBot({ botToken: "bad" })).rejects.toThrow("Invalid token");
    });
  });

  // ─── subscribeDiscordChannels ───────────────────────────────────────

  describe("subscribeDiscordChannels", () => {
    it("posts channel IDs and returns status", async () => {
      const response = { status: "subscribed" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await subscribeDiscordChannels("dc-1", ["ch-1", "ch-2"]);

      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/sources/discord/dc-1/subscribe",
        { channelIds: ["ch-1", "ch-2"] },
      );
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Not found"));

      await expect(subscribeDiscordChannels("bad", [])).rejects.toThrow("Not found");
    });
  });

  // ─── listDiscordBots ────────────────────────────────────────────────

  describe("listDiscordBots", () => {
    it("fetches discord sources", async () => {
      const bots = [{ id: "dc-1", botName: "Bot1" }];
      vi.mocked(apiClient.get).mockResolvedValue(bots);

      const result = await listDiscordBots();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sources/discord");
      expect(result).toEqual(bots);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Offline"));

      await expect(listDiscordBots()).rejects.toThrow("Offline");
    });
  });

  // ─── createMqttBroker ──────────────────────────────────────────────

  describe("createMqttBroker", () => {
    it("posts MQTT broker config and returns response", async () => {
      const params = { brokerUrl: "mqtt://localhost", topics: ["test/#"] };
      const response = { source: { id: "mqtt-1" }, status: "connected", errorMessage: null };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createMqttBroker(params);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/mqtt", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Connection refused"));

      await expect(createMqttBroker({ brokerUrl: "bad", topics: [] })).rejects.toThrow("Connection refused");
    });
  });

  // ─── createRssFeed ──────────────────────────────────────────────────

  describe("createRssFeed", () => {
    it("posts RSS feed config and returns response", async () => {
      const params = { feedUrl: "https://example.com/feed.xml" };
      const response = { sourceId: "rss-1", status: "active" };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createRssFeed(params);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/rss", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Invalid URL"));

      await expect(createRssFeed({ feedUrl: "bad" })).rejects.toThrow("Invalid URL");
    });
  });

  // ─── listRssFeeds ──────────────────────────────────────────────────

  describe("listRssFeeds", () => {
    it("fetches RSS feed sources", async () => {
      const feeds = [{ id: "rss-1", feedUrl: "https://example.com/feed.xml" }];
      vi.mocked(apiClient.get).mockResolvedValue(feeds);

      const result = await listRssFeeds();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sources/rss");
      expect(result).toEqual(feeds);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Timeout"));

      await expect(listRssFeeds()).rejects.toThrow("Timeout");
    });
  });

  // ─── listMqttBrokers ───────────────────────────────────────────────

  describe("listMqttBrokers", () => {
    it("fetches MQTT broker sources", async () => {
      const brokers = [{ source: { id: "mqtt-1" }, brokerUrl: "mqtt://localhost", topics: [] }];
      vi.mocked(apiClient.get).mockResolvedValue(brokers);

      const result = await listMqttBrokers();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sources/mqtt");
      expect(result).toEqual(brokers);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Offline"));

      await expect(listMqttBrokers()).rejects.toThrow("Offline");
    });
  });

  // ─── createEmailMailbox ─────────────────────────────────────────────

  describe("createEmailMailbox", () => {
    it("posts email mailbox config and returns response", async () => {
      const params = {
        imapHost: "imap.gmail.com",
        username: "user@gmail.com",
        password: "app-password",
      };
      const response = { source: { id: "email-1" }, status: "connected", errorMessage: null, channels: [] };
      vi.mocked(apiClient.post).mockResolvedValue(response);

      const result = await createEmailMailbox(params);

      expect(apiClient.post).toHaveBeenCalledWith("/api/v1/sources/email", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error("Auth failed"));

      await expect(
        createEmailMailbox({ imapHost: "imap.gmail.com", username: "u", password: "p" }),
      ).rejects.toThrow("Auth failed");
    });
  });

  // ─── updateEmailMailbox ─────────────────────────────────────────────

  describe("updateEmailMailbox", () => {
    it("patches email mailbox config and returns response", async () => {
      const params = { pollIntervalSeconds: 600 };
      const response = { source: { id: "email-1" }, status: "connected", errorMessage: null, channels: [] };
      vi.mocked(apiClient.patch).mockResolvedValue(response);

      const result = await updateEmailMailbox("email-1", params);

      expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/sources/email/email-1", params);
      expect(result).toEqual(response);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.patch).mockRejectedValue(new Error("Not found"));

      await expect(updateEmailMailbox("bad-id", {})).rejects.toThrow("Not found");
    });
  });

  // ─── listEmailMailboxes ─────────────────────────────────────────────

  describe("listEmailMailboxes", () => {
    it("fetches email mailbox sources", async () => {
      const mailboxes = [{ source: { id: "email-1" }, username: "user@gmail.com" }];
      vi.mocked(apiClient.get).mockResolvedValue(mailboxes);

      const result = await listEmailMailboxes();

      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/sources/email");
      expect(result).toEqual(mailboxes);
    });

    it("propagates errors", async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error("Timeout"));

      await expect(listEmailMailboxes()).rejects.toThrow("Timeout");
    });
  });
});
