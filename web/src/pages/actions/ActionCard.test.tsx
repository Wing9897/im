/**
 * Unit tests for ActionCard visual polish updates.
 *
 *
 * Tests:
 * - Card uses flat solid chrome (no elevated hover-lift shadow), matching FeedCard density
 * - Information hierarchy: action name (primary, weight 600), type badge (secondary), trigger/timestamp (tertiary)
 */
import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ActionCard } from "./ActionCard";
import type { Action } from "../../types";

const mockAction: Action = {
  id: "action-1",
  name: "My Test Action",
  actionType: "telegram_bot",
  configuration: JSON.stringify({ bot_token: "tok", chat_id: "123" }),
  triggerConditions: JSON.stringify({ score_threshold: 80 }),
  isEnabled: true,
  lastTriggeredAt: null,
  createdAt: "2024-06-01T12:00:00Z",
  updatedAt: "2024-06-01T12:00:00Z",
};

const noop = () => {};

function renderActionCard(action: Action = mockAction) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  act(() => {
    createRoot(container).render(
      createElement(ActionCard, {
        action,
        onToggle: noop,
        onEdit: noop,
        onDelete: noop,
        onTest: noop,
      })
    );
  });
  return container;
}

describe("ActionCard visual polish", () => {
  describe("card chrome", () => {
    it("uses elevated chrome without the card-hover lift class", () => {
      const container = renderActionCard();
      const card = container.firstElementChild as HTMLElement;
      expect(card.classList.contains("im-card-hover")).toBe(false);
      expect(container.querySelector(".im-material-elevated")).toBeTruthy();
      container.remove();
    });
  });

  describe("information hierarchy", () => {
    it("renders action name as primary title", () => {
      const container = renderActionCard();
      expect(container.textContent).toContain(mockAction.name);
      const title = container.querySelector(".truncate.font-medium");
      expect(title?.textContent).toBe(mockAction.name);
      container.remove();
    });

    it("renders action type badge", () => {
      const container = renderActionCard();
      expect(container.textContent).toContain("Telegram Bot");
      container.remove();
    });

    it("renders trigger and timestamp in meta line", () => {
      const container = renderActionCard();
      expect(container.textContent).toContain("分數 ≥ 80");
      expect(container.textContent).toContain("從未");
      container.remove();
    });

    it("renders enabled status pill", () => {
      const container = renderActionCard();
      expect(container.textContent).toContain("已啟用");
      container.remove();
    });

    it("calls onSelect when summary is clicked", () => {
      const onSelect = vi.fn();
      const container = document.createElement("div");
      document.body.appendChild(container);
      act(() => {
        createRoot(container).render(
          createElement(ActionCard, {
            action: mockAction,
            onToggle: noop,
            onEdit: noop,
            onDelete: noop,
            onTest: noop,
            onSelect,
          }),
        );
      });

      const summary = container.querySelector('[aria-label="查看通知詳情：My Test Action"]');
      expect(summary).toBeTruthy();

      act(() => {
        summary!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(onSelect).toHaveBeenCalledTimes(1);
      container.remove();
    });

    it("does not call onSelect when edit button is clicked", () => {
      const onSelect = vi.fn();
      const container = document.createElement("div");
      document.body.appendChild(container);
      act(() => {
        createRoot(container).render(
          createElement(ActionCard, {
            action: mockAction,
            onToggle: noop,
            onEdit: noop,
            onDelete: noop,
            onTest: noop,
            onSelect,
          }),
        );
      });

      const editButton = Array.from(container.querySelectorAll("button")).find(
        (btn) => btn.textContent === "編輯",
      );
      expect(editButton).toBeTruthy();

      act(() => {
        editButton!.click();
      });

      expect(onSelect).not.toHaveBeenCalled();
      container.remove();
    });
  });
});
