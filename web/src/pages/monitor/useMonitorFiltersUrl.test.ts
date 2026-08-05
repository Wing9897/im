import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import type { MessageFilters } from "../../types";
import {
  parseMonitorFiltersFromSearchParams,
  serializeMessageFilters,
  useMonitorFiltersUrl,
  writeMonitorFiltersToSearchParams,
} from "./useMonitorFiltersUrl";

function SecondDeepLinkHarness({
  onFilters,
}: {
  onFilters: (filters: MessageFilters) => void;
}) {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<MessageFilters>({});

  useMonitorFiltersUrl({
    filters,
    setFilters: (next) => {
      onFilters(next);
      setFilters(next);
    },
  });

  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "to-second-q",
      onClick: () => navigate("/monitor?q=eth&platform=discord"),
    },
    "second filters",
  );
}

describe("useMonitorFiltersUrl helpers", () => {
  it("returns null when no filter keys are present", () => {
    const params = new URLSearchParams("id=msg-1");
    expect(parseMonitorFiltersFromSearchParams(params)).toBeNull();
  });

  it("parses filter query keys", () => {
    const params = new URLSearchParams(
      "q=btc&platform=telegram&time=today&sources=a1,a2&channels=telegram:1",
    );
    expect(parseMonitorFiltersFromSearchParams(params)).toEqual({
      search: "btc",
      platform: "telegram",
      timeRange: "today",
      sourceIds: ["a1", "a2"],
      channelIds: ["telegram:1"],
    });
  });

  it("writes filters without dropping unrelated keys", () => {
    const params = new URLSearchParams("id=msg-1");
    writeMonitorFiltersToSearchParams(params, {
      search: "eth",
      platform: "discord",
      timeRange: "7d",
    });
    expect(params.get("id")).toBe("msg-1");
    expect(params.get("q")).toBe("eth");
    expect(params.get("platform")).toBe("discord");
    expect(params.get("time")).toBe("7d");
  });

  it("clears filter keys when filters are empty", () => {
    const params = new URLSearchParams("q=btc&platform=telegram&id=keep");
    writeMonitorFiltersToSearchParams(params, {});
    expect(params.get("q")).toBeNull();
    expect(params.get("platform")).toBeNull();
    expect(params.get("id")).toBe("keep");
  });

  it("serializes filters stably for hydrate comparisons", () => {
    expect(
      serializeMessageFilters({
        search: "btc",
        platform: "telegram",
        timeRange: "today",
      }),
    ).toBe("q=btc&platform=telegram&time=today");
  });
});

describe("useMonitorFiltersUrl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("applies a second filter deep link while staying mounted", async () => {
    const onFilters = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor?q=btc&platform=telegram"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/monitor",
              element: createElement(SecondDeepLinkHarness, { onFilters }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onFilters).toHaveBeenCalledWith({
      search: "btc",
      platform: "telegram",
    });
    onFilters.mockClear();

    await act(async () => {
      (container.querySelector('[data-testid="to-second-q"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onFilters).toHaveBeenCalledWith({
      search: "eth",
      platform: "discord",
    });
  });
});
