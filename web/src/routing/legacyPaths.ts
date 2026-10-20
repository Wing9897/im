/**
 * One table for retired URLs. App routes, the command palette, and
 * `im:pages-last-path` all read this module.
 *
 * A match keeps the original query keys that the destination does not set,
 * and keeps the hash.
 */

export type LegacyRedirectRule = {
  /**
   * Pathname, or pathname plus the query that distinguishes the rule.
   * Tests walk every probe.
   */
  probe: string;
  match: (pathname: string, search?: string) => boolean;
  destination: (pathname: string, search?: string) => string;
};

function searchParamsOf(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const hashAt = raw.indexOf("#");
  return new URLSearchParams(hashAt >= 0 ? raw.slice(0, hashAt) : raw);
}

function isWorksetGraphQuery(search = ""): boolean {
  const tab = searchParamsOf(search).get("tab");
  return tab === "graph" || tab === "flow";
}

const WORKSET_DETAIL = /^\/worksets\/([^/]+)$/;
const SCHEDULE_SERIES_EDIT = /^\/schedule\/recurring\/([^/]+)\/edit$/;
const SUBSCRIPTION_TAB = /^\/subscriptions\/(mine|published|account|search)$/;

function subscriptionsSheet(tab: string): string {
  return `/timeline?sheet=subscriptions&tab=${tab}`;
}

export const LEGACY_REDIRECTS: readonly LegacyRedirectRule[] = [
  {
    probe: "/leaderboard",
    match: (pathname) => pathname === "/leaderboard",
    destination: () => "/intelligence?tab=topics",
  },
  {
    probe: "/worksets?tab=graph",
    match: (pathname, search = "") => pathname === "/worksets" && isWorksetGraphQuery(search),
    destination: () => "/tasks?tab=graph",
  },
  {
    probe: "/worksets",
    match: (pathname, search = "") => pathname === "/worksets" && !isWorksetGraphQuery(search),
    destination: () => "/timeline?workset=list",
  },
  {
    probe: "/worksets/ws-1",
    match: (pathname) => WORKSET_DETAIL.test(pathname),
    destination: (pathname) => {
      const id = WORKSET_DETAIL.exec(pathname)?.[1] ?? "";
      return `/timeline?workset=${id}`;
    },
  },
  {
    probe: "/schedule",
    match: (pathname) => pathname === "/schedule",
    destination: () => "/timeline?sheet=schedule",
  },
  {
    probe: "/schedule/recurring/series-1/edit",
    match: (pathname) => SCHEDULE_SERIES_EDIT.test(pathname),
    destination: (pathname) => {
      const id = SCHEDULE_SERIES_EDIT.exec(pathname)?.[1] ?? "";
      const params = new URLSearchParams();
      params.set("sheet", "schedule");
      params.set("series", decodeURIComponent(id));
      return `/timeline?${params.toString()}`;
    },
  },
  {
    probe: "/subscriptions",
    match: (pathname) => pathname === "/subscriptions",
    destination: () => subscriptionsSheet("mine"),
  },
  {
    probe: "/subscriptions/mine",
    match: (pathname) => pathname === "/subscriptions/mine",
    destination: () => subscriptionsSheet("mine"),
  },
  {
    probe: "/subscriptions/published",
    match: (pathname) => pathname === "/subscriptions/published",
    destination: () => subscriptionsSheet("published"),
  },
  {
    probe: "/subscriptions/account",
    match: (pathname) => pathname === "/subscriptions/account",
    destination: () => subscriptionsSheet("account"),
  },
  {
    probe: "/subscriptions/search",
    match: (pathname) => pathname === "/subscriptions/search",
    destination: () => subscriptionsSheet("search"),
  },
  {
    probe: "/subscriptions/other",
    match: (pathname) =>
      pathname.startsWith("/subscriptions/") && !SUBSCRIPTION_TAB.test(pathname),
    destination: () => subscriptionsSheet("mine"),
  },
];

export function legacyRedirectDestination(pathname: string, search = ""): string | null {
  const rule = LEGACY_REDIRECTS.find((entry) => entry.match(pathname, search));
  return rule ? rule.destination(pathname, search) : null;
}

export function requireLegacyDestination(pathname: string): string {
  const destination = legacyRedirectDestination(pathname);
  if (!destination) {
    throw new Error(`No legacy redirect for ${pathname}`);
  }
  return destination;
}

function splitLocation(path: string): { pathname: string; search: string; hash: string } {
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = withoutHash.indexOf("?");
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const search = queryIndex >= 0 ? withoutHash.slice(queryIndex) : "";
  return { pathname, search, hash };
}

/** Merge destination query with the visitor's query. Destination keys win. */
export function mergeLegacyTarget(destination: string, search: string, hash = ""): string {
  const dest = splitLocation(destination);
  const params = new URLSearchParams(dest.search.startsWith("?") ? dest.search.slice(1) : dest.search);
  const original = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const [key, value] of original) {
    if (!params.has(key)) params.append(key, value);
  }
  const qs = params.toString();
  const resolvedHash = hash || dest.hash;
  return `${dest.pathname}${qs ? `?${qs}` : ""}${resolvedHash}`;
}

/** Resolved location for a retired pathname, or null when the path is current. */
export function applyLegacyRedirect(
  pathname: string,
  search: string,
  hash = "",
): string | null {
  const destination = legacyRedirectDestination(pathname, search);
  if (!destination) return null;
  return mergeLegacyTarget(destination, search, hash);
}

/**
 * Rewrite a stored pages path (`pathname` + search + hash) when it is a retired URL.
 * Current paths are returned unchanged.
 */
export function normalizeLegacyPath(path: string): string {
  const { pathname, search, hash } = splitLocation(path);
  return applyLegacyRedirect(pathname, search, hash) ?? path;
}
