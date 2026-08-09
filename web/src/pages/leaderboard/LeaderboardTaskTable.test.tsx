import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Message, TrendingTopic } from "../../types";
import { LeaderboardTaskTable } from "./LeaderboardTaskTable";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

// Vitest runs with cwd at web/, so resolve the shared layout stylesheet from there.
const globalCss = readFileSync(resolve(process.cwd(), "src/css/shared-layout.css"), "utf-8");

const mockTopics: TrendingTopic[] = [
  {
    id: "topic-1",
    topicName: "Test Topic 1",
    score: 9.5,
    rank: 1,
    summary: "Summary 1",
    updatedAt: "2026-04-17T03:00:00.000Z",
    taskId: "task-1",
    version: 1,
    batchId: "batch-1",
    taskName: "Test Task",
    createdAt: "2026-04-17T03:00:00.000Z",
  },
  {
    id: "topic-2",
    topicName: "Test Topic 2",
    score: 8.0,
    rank: 2,
    summary: "Summary 2",
    updatedAt: "2026-04-17T02:00:00.000Z",
    taskId: "task-1",
    version: 1,
    batchId: "batch-1",
    taskName: "Test Task",
    createdAt: "2026-04-17T02:00:00.000Z",
  },
];

function tableTree(props: {
  taskName: string;
  topics: TrendingTopic[];
  expandedTopicId: string | null;
  topicMessages: Record<string, Message[]>;
  loadingMessages: Record<string, boolean>;
  topicMessageErrors: Record<string, string>;
  onToggleTopic: () => void;
}) {
  return wrapWithI18n(createElement(LeaderboardTaskTable, props));
}

describe("LeaderboardTaskTable visual updates", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  describe("modal dialog", () => {
    it("renders role=dialog when a topic is expanded", () => {
      act(() => {
        root = createRoot(container);
        root.render(
          tableTree({
            taskName: "Test Task",
            topics: mockTopics,
            expandedTopicId: "topic-1",
            topicMessages: {} as Record<string, Message[]>,
            loadingMessages: {},
            topicMessageErrors: {},
            onToggleTopic: () => {},
          }),
        );
      });

      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it("does not render an expanded placeholder / aria-hidden topic row", () => {
      act(() => {
        root = createRoot(container);
        root.render(
          tableTree({
            taskName: "Test Task",
            topics: mockTopics,
            expandedTopicId: "topic-1",
            topicMessages: {} as Record<string, Message[]>,
            loadingMessages: {},
            topicMessageErrors: {},
            onToggleTopic: () => {},
          }),
        );
      });

      expect(container.textContent).not.toContain("展開中…");
      expect(container.querySelector('tr[aria-hidden="true"]')).toBeNull();
    });
  });

  describe("row hover styles", () => {
    it("applies CSS hover class on row button", () => {
      act(() => {
        root = createRoot(container);
        root.render(
          tableTree({
            taskName: "Test Task",
            topics: mockTopics,
            expandedTopicId: null,
            topicMessages: {} as Record<string, Message[]>,
            loadingMessages: {},
            topicMessageErrors: {},
            onToggleTopic: () => {},
          }),
        );
      });

      const firstRowButton = container.querySelectorAll("button[type='button']")[0] as HTMLButtonElement;
      expect(firstRowButton.classList.contains("im-leaderboard-row-btn")).toBe(true);
      expect(firstRowButton.classList.contains("im-leaderboard-row-expanded")).toBe(false);
    });
  });

  describe("board grid CSS class responsive breakpoints", () => {
    it("im-board-grid class defines 4-column dense grid with 24px gap", () => {
      const ruleMatch = globalCss.match(/\.im-board-grid\s*\{([^}]*)\}/);
      expect(ruleMatch).not.toBeNull();
      const rule = ruleMatch![1];
      expect(rule).toContain("display: grid");
      expect(rule).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
      expect(rule).toContain("gap: 24px");
    });

    it("im-board-grid collapses columns at responsive breakpoints", () => {
      expect(globalCss).toMatch(/@media \(max-width: 1200px\)\s*\{\s*\.im-board-grid\s*\{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
      expect(globalCss).toMatch(/@media \(max-width: 900px\)\s*\{\s*\.im-board-grid\s*\{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
      expect(globalCss).toMatch(/@media \(max-width: 600px\)\s*\{\s*\.im-board-grid\s*\{\s*grid-template-columns: minmax\(0, 1fr\)/);
    });
  });
});
