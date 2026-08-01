import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";

import type { ViewMode } from "../../types";
import { useIntelligenceUrlState } from "./useIntelligenceUrlState";

function SecondDeepLinkHarness({
  onViewMode,
  onSearch,
  onSelectedId,
}: {
  onViewMode: (mode: ViewMode) => void;
  onSearch: (value: string) => void;
  onSelectedId: (id: string | null) => void;
}) {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useIntelligenceUrlState({
    viewMode,
    setViewMode: (mode) => {
      onViewMode(mode);
      setViewMode(mode);
    },
    search,
    setSearch: (value) => {
      onSearch(value);
      setSearch(value);
    },
    selectedId,
    onSelectedIdFromUrl: (id) => {
      onSelectedId(id);
      setSelectedId(id);
    },
  });

  return createElement(
    "div",
    null,
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "to-second-id",
        onClick: () => navigate("/intelligence?id=item-2&view=map"),
      },
      "second id",
    ),
    createElement(
      "button",
      {
        type: "button",
        "data-testid": "to-second-q",
        onClick: () => navigate("/intelligence?q=eth&view=list"),
      },
      "second q",
    ),
  );
}

describe("useIntelligenceUrlState", () => {
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

  it("applies a second ?id= / ?view= deep link while staying mounted", async () => {
    const onViewMode = vi.fn();
    const onSearch = vi.fn();
    const onSelectedId = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/intelligence?id=item-1&view=card"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/intelligence",
              element: createElement(SecondDeepLinkHarness, {
                onViewMode,
                onSearch,
                onSelectedId,
              }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSelectedId).toHaveBeenCalledWith("item-1");
    onViewMode.mockClear();
    onSelectedId.mockClear();

    await act(async () => {
      (container.querySelector('[data-testid="to-second-id"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSelectedId).toHaveBeenCalledWith("item-2");
    expect(onViewMode).toHaveBeenCalledWith("map");
  });

  it("applies a second ?q= deep link while staying mounted", async () => {
    const onViewMode = vi.fn();
    const onSearch = vi.fn();
    const onSelectedId = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/intelligence?q=btc&view=card"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/intelligence",
              element: createElement(SecondDeepLinkHarness, {
                onViewMode,
                onSearch,
                onSelectedId,
              }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSearch).toHaveBeenCalledWith("btc");
    onViewMode.mockClear();
    onSearch.mockClear();

    await act(async () => {
      (container.querySelector('[data-testid="to-second-q"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onSearch).toHaveBeenCalledWith("eth");
    expect(onViewMode).toHaveBeenCalledWith("list");
  });
});
