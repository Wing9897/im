import i18n from "../../../../i18n";
import type { RssProviderId } from "./types";

type CuratedRssProviderId = Exclude<RssProviderId, "generic">;

const GITHUB_ATOM =
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(?:releases|tags|commits\/[\w./-]+)\.atom(?:\?.*)?$/i;

const HACKERNEWS_RSS =
  /^https:\/\/(?:hnrss\.org\/[\w-]+(?:\?.*)?|news\.ycombinator\.com\/rss(?:\?.*)?)$/i;

const LINUX_DO_RSS =
  /^https:\/\/(?:www\.)?linux\.do\/(latest|top|posts)\.rss(?:\?.*)?$/i;

const V2EX_TAB_RSS =
  /^https:\/\/(?:www\.)?v2ex\.com\/feed\/tab\/[a-z0-9-]+\.xml(?:\?.*)?$/i;

/** Classify generic-RSS feed URLs owned by a curated provider. */
export function classifyCuratedRssUrl(url: string): CuratedRssProviderId | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (GITHUB_ATOM.test(trimmed)) return "github";
  if (HACKERNEWS_RSS.test(trimmed)) return "hackernews";
  if (LINUX_DO_RSS.test(trimmed)) return "linuxdo";
  if (V2EX_TAB_RSS.test(trimmed)) return "v2ex";
  return null;
}

export function isGitHubRssUrl(url: string): boolean {
  return classifyCuratedRssUrl(url) === "github";
}

export function isHackerNewsRssUrl(url: string): boolean {
  return classifyCuratedRssUrl(url) === "hackernews";
}

export function isLinuxDoRssUrl(url: string): boolean {
  return classifyCuratedRssUrl(url) === "linuxdo";
}

export function isV2exRssUrl(url: string): boolean {
  return classifyCuratedRssUrl(url) === "v2ex";
}

export function validateGitHubFeedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return String(i18n.t("sources:rssValidate.githubRequired"));
  if (!trimmed.startsWith("https://github.com/")) {
    return String(i18n.t("sources:rssValidate.githubHttps"));
  }
  let pathname: string;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    return String(i18n.t("sources:rssValidate.githubInvalid"));
  }
  if (!pathname.endsWith(".atom")) {
    return String(i18n.t("sources:rssValidate.githubAtomSuffix"));
  }
  if (!isGitHubRssUrl(trimmed)) {
    return String(i18n.t("sources:rssValidate.githubKind"));
  }
  return null;
}

export function validateHackerNewsFeedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return String(i18n.t("sources:rssValidate.hnRequired"));
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return String(i18n.t("sources:rssValidate.hnHttp"));
  }
  if (!isHackerNewsRssUrl(trimmed)) {
    return String(i18n.t("sources:rssValidate.hnPattern"));
  }
  return null;
}

export function validateLinuxDoFeedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return String(i18n.t("sources:rssValidate.linuxdoRequired"));
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return String(i18n.t("sources:rssValidate.linuxdoHttp"));
  }
  if (!isLinuxDoRssUrl(trimmed)) {
    return String(i18n.t("sources:rssValidate.linuxdoPattern"));
  }
  return null;
}

export function validateV2exFeedUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return String(i18n.t("sources:rssValidate.v2exRequired"));
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return String(i18n.t("sources:rssValidate.v2exHttp"));
  }
  if (!isV2exRssUrl(trimmed)) {
    return String(i18n.t("sources:rssValidate.v2exPattern"));
  }
  return null;
}

/** Build a standard GitHub Atom feed URL from owner/repo. */
export function githubAtomUrl(ownerRepo: string, kind: "releases" | "tags" | "commits"): string {
  const slug = ownerRepo.trim().replace(/^\/+|\/+$/g, "");
  if (kind === "commits") {
    return `https://github.com/${slug}/commits/master.atom`;
  }
  return `https://github.com/${slug}/${kind}.atom`;
}
