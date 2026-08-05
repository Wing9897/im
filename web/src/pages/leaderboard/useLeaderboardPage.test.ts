import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEADERBOARD_EXPANDED_TOPIC_ID_STORAGE_KEY } from "../../domain/prefs";

vi.mock("../../api/results", () => ({
  fetchTrendingTopics: vi.fn(async () => []),
  fetchTopicMessages: vi.fn(async () => []),
}));

vi.mock("../../context/TaskCatalogContext", () => ({
  useTaskCatalog: () => ({
    tasks: [],
    taskLoadError: null,
    tasksLoading: false,
  }),
}));

vi.mock("../../hooks/useChannelsWithSources", () => ({
  useChannelsWithSources: () => ({ channels: [] }),
}));

vi.mock("../../hooks/useRefreshOnAnalysisEvent", () => ({
  useRefreshOnAnalysisEvent: vi.fn(),
}));

import { useLeaderboardPage } from "./useLeaderboardPage";

let latest: ReturnType<typeof useLeaderboardPage> | null = null;

function Harness() {
  latest = useLeaderboardPage();
  return null;
}

describe("useLeaderboardPage expanded topic persistence", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    localStorage.clear();
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

  async function renderHook() {
    await act(async () => {
      root.render(createElement(Harness));
      await Promise.resolve();
    });
  }

  it("persists expanded topic id in localStorage", async () => {
    await renderHook();

    await act(async () => {
      await latest!.handleToggleTopic("topic-a");
    });

    expect(latest!.expandedTopicId).toBe("topic-a");
    expect(localStorage.getItem(LEADERBOARD_EXPANDED_TOPIC_ID_STORAGE_KEY)).toBe(
      JSON.stringify("topic-a"),
    );

    await act(async () => {
      root.unmount();
    });
    root = createRoot(container);
    await renderHook();

    expect(latest!.expandedTopicId).toBe("topic-a");
  });
});
