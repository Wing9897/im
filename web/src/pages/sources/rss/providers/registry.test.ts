import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../../i18n";
import { setAppLocale } from "../../../../i18n/locale";

const { mockListRssFeeds } = vi.hoisted(() => ({
  mockListRssFeeds: vi.fn(),
}));

vi.mock("../../../../api/sources", () => ({
  listRssFeeds: mockListRssFeeds,
}));

import { githubRssProvider } from "./github/githubProvider";
import { genericRssProvider } from "./genericProvider";
import { hackernewsRssProvider } from "./hackernews/hackernewsProvider";
import { linuxdoRssProvider } from "./linuxdo/linuxdoProvider";
import { v2exRssProvider } from "./v2ex/v2exProvider";
import {
  DEFAULT_RSS_PROVIDER_ID,
  getRssProvider,
  groupRssProvidersForPicker,
  listAllRssTabFeeds,
  resolveProviderForFeed,
  RSS_CURATED_PROVIDERS,
  RSS_PROVIDERS,
} from "./registry";
import {
  classifyCuratedRssUrl,
  isGitHubRssUrl,
  isHackerNewsRssUrl,
  isLinuxDoRssUrl,
  isV2exRssUrl,
  validateGitHubFeedUrl,
  validateLinuxDoFeedUrl,
  validateV2exFeedUrl,
} from "./rssUrlPatterns";
import type { RssFeedItem } from "./types";

function makeFeed(platform: string, feedUrl: string, providerId: RssFeedItem["providerId"]): RssFeedItem {
  return {
    source: {
      id: "acc-1",
      platform,
      name: "Feed",
      status: "connected",
      lastError: null,
      lastConnectedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    channel: null,
    feedUrl,
    pollIntervalSeconds: 300,
    lastError: null,
    lastSuccessAt: null,
    providerId,
  };
}

describe("RSS provider registry", () => {
  beforeEach(async () => {
    mockListRssFeeds.mockReset();
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("registers curated providers before generic fallback", () => {
    expect(RSS_CURATED_PROVIDERS.map((p) => p.id)).toEqual([
      "linuxdo",
      "v2ex",
      "hackernews",
      "github",
    ]);
    expect(RSS_PROVIDERS.map((p) => p.id)).toEqual([
      "linuxdo",
      "v2ex",
      "hackernews",
      "github",
      "generic",
    ]);
    expect(DEFAULT_RSS_PROVIDER_ID).toBe("generic");
  });

  it("groups providers for the scalable select UI", () => {
    expect(groupRssProvidersForPicker().map((entry) => entry.group)).toEqual([
      "zhCommunity",
      "techNews",
      "devTools",
      "custom",
    ]);
    const zhGroup = groupRssProvidersForPicker().find((entry) => entry.group === "zhCommunity");
    expect(zhGroup?.providers.map((provider) => provider.id)).toEqual(["linuxdo", "v2ex"]);
  });

  it("resolves feeds to the correct provider", () => {
    expect(
      resolveProviderForFeed(
        makeFeed("rss", "https://github.com/o/r/releases.atom", "github"),
      ).id,
    ).toBe("github");
    expect(
      resolveProviderForFeed(makeFeed("rss", "https://hnrss.org/frontpage", "hackernews")).id,
    ).toBe("hackernews");
    expect(
      resolveProviderForFeed(makeFeed("rss", "https://linux.do/latest.rss", "linuxdo")).id,
    ).toBe("linuxdo");
    expect(
      resolveProviderForFeed(
        makeFeed("rss", "https://www.v2ex.com/feed/tab/tech.xml", "v2ex"),
      ).id,
    ).toBe("v2ex");
    expect(
      resolveProviderForFeed(makeFeed("rss", "https://example.com/feed.xml", "generic")).id,
    ).toBe("generic");
  });

  it("fetches once, classifies every feed, and sorts newest first", async () => {
    const generic = makeFeed("rss", "https://example.com/feed.xml", "generic");
    const github = makeFeed("rss", "https://github.com/o/r/releases.atom?source=app", "generic");
    mockListRssFeeds.mockResolvedValue([
      generic,
      {
        ...github,
        source: { ...github.source, id: "acc-2", createdAt: "2026-02-01T00:00:00.000Z" },
      },
    ]);

    const feeds = await listAllRssTabFeeds();

    expect(mockListRssFeeds).toHaveBeenCalledTimes(1);
    expect(feeds.map((feed) => [feed.source.id, feed.providerId])).toEqual([
      ["acc-2", "github"],
      ["acc-1", "generic"],
    ]);
  });

  it("returns provider definitions by id", () => {
    expect(getRssProvider("github")).toBe(githubRssProvider);
    expect(getRssProvider("hackernews")).toBe(hackernewsRssProvider);
    expect(getRssProvider("linuxdo")).toBe(linuxdoRssProvider);
    expect(getRssProvider("v2ex")).toBe(v2exRssProvider);
    expect(getRssProvider("generic")).toBe(genericRssProvider);
  });
});

describe("RSS URL classification", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
  });

  it("detects GitHub atom feeds", () => {
    expect(isGitHubRssUrl("https://github.com/torvalds/linux/releases.atom")).toBe(true);
    expect(classifyCuratedRssUrl("https://github.com/torvalds/linux/releases.atom")).toBe("github");
    expect(validateGitHubFeedUrl("https://github.com/torvalds/linux/releases.atom")).toBeNull();
  });

  it("detects Hacker News feeds", () => {
    expect(isHackerNewsRssUrl("https://hnrss.org/frontpage")).toBe(true);
    expect(classifyCuratedRssUrl("https://hnrss.org/newest")).toBe("hackernews");
  });

  it("detects LINUX.DO official feeds", () => {
    expect(isLinuxDoRssUrl("https://linux.do/latest.rss")).toBe(true);
    expect(classifyCuratedRssUrl("https://linux.do/top.rss")).toBe("linuxdo");
    expect(validateLinuxDoFeedUrl("https://linux.do/posts.rss")).toBeNull();
    expect(validateLinuxDoFeedUrl("https://rsshub.app/linux-do/latest")).toBe(
      i18n.t("sources:rssValidate.linuxdoPattern"),
    );
  });

  it("detects V2EX official tab feeds", () => {
    expect(isV2exRssUrl("https://www.v2ex.com/feed/tab/all.xml")).toBe(true);
    expect(classifyCuratedRssUrl("https://www.v2ex.com/feed/tab/creative.xml")).toBe("v2ex");
    expect(validateV2exFeedUrl("https://www.v2ex.com/feed/tab/play.xml")).toBeNull();
    expect(validateV2exFeedUrl("https://v2ex.com/latest")).toBe(
      i18n.t("sources:rssValidate.v2exPattern"),
    );
  });
});
