import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";

import {
  MONITOR_MODE_KEY,
  PAGES_LAST_PATH_KEY,
  MonitorModeProvider,
  useMonitorMode,
} from "../context/MonitorModeContext";
import {
  LEGACY_REDIRECTS,
  applyLegacyRedirect,
  normalizeLegacyPath,
} from "./legacyPaths";

const EXPECTED_DESTINATIONS: Record<string, string> = {
  "/leaderboard": "/intelligence?tab=topics",
  "/worksets?tab=graph": "/tasks?tab=graph",
  "/worksets": "/timeline?workset=list",
  "/worksets/ws-1": "/timeline?workset=ws-1",
  "/schedule": "/timeline?sheet=schedule",
  "/schedule/recurring/series-1/edit": "/timeline?sheet=schedule&series=series-1",
  "/subscriptions": "/timeline?sheet=subscriptions&tab=mine",
  "/subscriptions/mine": "/timeline?sheet=subscriptions&tab=mine",
  "/subscriptions/published": "/timeline?sheet=subscriptions&tab=published",
  "/subscriptions/account": "/timeline?sheet=subscriptions&tab=account",
  "/subscriptions/search": "/timeline?sheet=subscriptions&tab=search",
  "/subscriptions/other": "/timeline?sheet=subscriptions&tab=mine",
};

function probeParts(probe: string): { pathname: string; search: string } {
  const queryAt = probe.indexOf("?");
  if (queryAt < 0) return { pathname: probe, search: "" };
  return { pathname: probe.slice(0, queryAt), search: probe.slice(queryAt) };
}

function PagesButton() {
  const { setMonitorMode } = useMonitorMode();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "to-pages",
      onClick: () => setMonitorMode("pages"),
    },
    "pages",
  );
}

function LocationProbe({ onPath }: { onPath: (path: string) => void }) {
  const location = useLocation();
  useEffect(() => {
    onPath(`${location.pathname}${location.search}${location.hash}`);
  }, [location.hash, location.pathname, location.search, onPath]);
  return null;
}

describe("legacy redirects", () => {
  it("covers every rule in the redirect table", () => {
    expect(LEGACY_REDIRECTS.map((rule) => rule.probe).sort()).toEqual(
      Object.keys(EXPECTED_DESTINATIONS).sort(),
    );
    for (const rule of LEGACY_REDIRECTS) {
      const { pathname, search } = probeParts(rule.probe);
      expect(rule.match(pathname, search)).toBe(true);
      expect(rule.destination(pathname, search)).toBe(EXPECTED_DESTINATIONS[rule.probe]);
      expect(applyLegacyRedirect(pathname, search)).toBe(EXPECTED_DESTINATIONS[rule.probe]);
    }
  });

  it("keeps the visitor query and hash, and lets the destination tab win", () => {
    expect(applyLegacyRedirect("/leaderboard", "?range=7d")).toBe(
      "/intelligence?tab=topics&range=7d",
    );
    expect(applyLegacyRedirect("/leaderboard", "?tab=other&x=1", "#hot")).toBe(
      "/intelligence?tab=topics&x=1#hot",
    );
    expect(applyLegacyRedirect("/schedule", "?x=1", "#day")).toBe(
      "/timeline?sheet=schedule&x=1#day",
    );
    expect(applyLegacyRedirect("/subscriptions/mine", "?tab=search&q=ops")).toBe(
      "/timeline?sheet=subscriptions&tab=mine&q=ops",
    );
  });

  it("leaves current paths alone", () => {
    expect(applyLegacyRedirect("/intelligence", "?tab=topics")).toBeNull();
    expect(normalizeLegacyPath("/timeline?workset=list")).toBe("/timeline?workset=list");
    expect(normalizeLegacyPath("/notify")).toBe("/notify");
  });
});

describe("im:pages-last-path normalization", () => {
  it("rewrites a stored leaderboard path", () => {
    expect(normalizeLegacyPath("/leaderboard")).toBe("/intelligence?tab=topics");
    expect(normalizeLegacyPath("/leaderboard?range=7d#row")).toBe(
      "/intelligence?tab=topics&range=7d#row",
    );
  });

  it("rewrites a stored workset path", () => {
    expect(normalizeLegacyPath("/worksets/ws-1?x=1")).toBe("/timeline?workset=ws-1&x=1");
    expect(normalizeLegacyPath("/worksets?tab=graph")).toBe("/tasks?tab=graph");
  });

  it("rewrites stored schedule and subscription paths", () => {
    expect(normalizeLegacyPath("/schedule")).toBe("/timeline?sheet=schedule");
    expect(normalizeLegacyPath("/schedule?x=1#day")).toBe("/timeline?sheet=schedule&x=1#day");
    expect(normalizeLegacyPath("/schedule/recurring/series-1/edit")).toBe(
      "/timeline?sheet=schedule&series=series-1",
    );
    expect(normalizeLegacyPath("/subscriptions")).toBe("/timeline?sheet=subscriptions&tab=mine");
    expect(normalizeLegacyPath("/subscriptions/search?q=ops")).toBe(
      "/timeline?sheet=subscriptions&tab=search&q=ops",
    );
    expect(normalizeLegacyPath("/subscriptions/other")).toBe(
      "/timeline?sheet=subscriptions&tab=mine",
    );
  });

  it("sends canvas→pages to the normalized stored path", async () => {
    window.localStorage.clear();
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    window.localStorage.setItem(PAGES_LAST_PATH_KEY, "/leaderboard?range=7d");

    let lastPath = "";
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor"] },
          createElement(
            MonitorModeProvider,
            null,
            createElement(LocationProbe, {
              onPath: (path: string) => {
                lastPath = path;
              },
            }),
            createElement(PagesButton),
          ),
        ),
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="to-pages"]')!.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(lastPath).toBe("/intelligence?tab=topics&range=7d");
    expect(window.localStorage.getItem(PAGES_LAST_PATH_KEY)).toBe(
      "/intelligence?tab=topics&range=7d",
    );

    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });
});
