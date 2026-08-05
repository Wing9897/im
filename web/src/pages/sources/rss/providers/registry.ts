import { listRssFeeds } from "../../../../api/sources";
import { githubRssProvider } from "./github/githubProvider";
import { genericRssProvider } from "./genericProvider";
import { hackernewsRssProvider } from "./hackernews/hackernewsProvider";
import { linuxdoRssProvider } from "./linuxdo/linuxdoProvider";
import { v2exRssProvider } from "./v2ex/v2exProvider";
import { classifyCuratedRssUrl } from "./rssUrlPatterns";
import type { RssFeedItem, RssProviderDefinition, RssProviderId } from "./types";

/** Curated presets — order within each picker group is stable for the select UI. */
export const RSS_CURATED_PROVIDERS: RssProviderDefinition[] = [
  linuxdoRssProvider,
  v2exRssProvider,
  hackernewsRssProvider,
  githubRssProvider,
];

/** Curated + generic RSS providers. Generic is always last in the picker. */
export const RSS_PROVIDERS: RssProviderDefinition[] = [
  ...RSS_CURATED_PROVIDERS,
  genericRssProvider,
];

export const DEFAULT_RSS_PROVIDER_ID: RssProviderId = "generic";

interface RssProviderPickerGroup {
  group: string;
  providers: RssProviderDefinition[];
}

/** Build optgroup rows for the scalable provider select. */
export function groupRssProvidersForPicker(
  providers: RssProviderDefinition[] = RSS_PROVIDERS,
): RssProviderPickerGroup[] {
  const groups: RssProviderPickerGroup[] = [];
  const indexByGroup = new Map<string, number>();

  for (const provider of providers) {
    const existing = indexByGroup.get(provider.pickerGroupKey);
    if (existing === undefined) {
      indexByGroup.set(provider.pickerGroupKey, groups.length);
      groups.push({ group: provider.pickerGroupKey, providers: [provider] });
      continue;
    }
    groups[existing].providers.push(provider);
  }

  return groups;
}

export function getRssProvider(id: RssProviderId): RssProviderDefinition {
  const provider = RSS_PROVIDERS.find((entry) => entry.id === id);
  if (!provider) {
    throw new Error(`Unknown RSS provider: ${id}`);
  }
  return provider;
}

export function resolveProviderForFeed(feed: RssFeedItem): RssProviderDefinition {
  return getRssProvider(feed.providerId);
}

export async function listAllRssTabFeeds(): Promise<RssFeedItem[]> {
  const feeds = await listRssFeeds();
  return feeds
    .map((feed): RssFeedItem => {
      const providerId: RssProviderId = classifyCuratedRssUrl(feed.feedUrl) ?? "generic";
      return { ...feed, providerId };
    })
    .sort(
      (a, b) =>
        new Date(b.source.createdAt).getTime() - new Date(a.source.createdAt).getTime(),
    );
}
