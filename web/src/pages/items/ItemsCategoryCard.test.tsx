import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../components/items/emoji/emojiPickerReactMock";
import { ItemsCategoryCard } from "./ItemsCategoryCard";
import type { CategorySummary } from "../../domain/items/categoryAggregates";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "categoryItemCount") return `${opts?.count ?? 0} items`;
      if (key === "categoryExpiringCount") return `${opts?.count ?? 0} soon`;
      if (key === "categoryOverdueCount") return `${opts?.count ?? 0} overdue`;
      if (key === "openCategoryAria") return `Open ${opts?.name ?? ""}`;
      if (key === "changeEmojiAria") return `Change emoji for ${opts?.name ?? ""}`;
      if (key === "emojiPickerAria") return "Choose an emoji";
      if (key === "emojiClear") return "Clear";
      if (key === "emojiHint") return "hint";
      if (key === "done") return "Done";
      if (key === "dialog.close") return "Close";
      if (key === "allCategories") return "All types";
      if (key === "categoryEmptyHint") return "empty";
      if (key === "noCategory") return "Uncategorized";
      if (key.startsWith("seed.")) return key;
      return key;
    },
  }),
}));

describe("ItemsCategoryCard", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
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

  it("renders counts and invokes onOpen", () => {
    const onOpen = vi.fn();
    const summary: CategorySummary = {
      id: "c1",
      category: {
        id: "c1",
        name: "Food",
        slug: "food",
        sortOrder: 1,
        color: "#22C55E",
        emoji: "🍎",
        defaultRemindBeforeDays: 3,
        createdAt: null,
        updatedAt: null,
      },
      itemCount: 4,
      expiringCount: 2,
      overdueCount: 1,
    };

    act(() => {
      root = createRoot(container);
      root.render(<ItemsCategoryCard summary={summary} onOpen={onOpen} />);
    });

    expect(container.textContent).toContain("4 items");
    expect(container.textContent).toContain("2 soon");
    expect(container.textContent).toContain("1 overdue");
    expect(container.textContent).toContain("🍎");
    expect(container.querySelector('[data-testid="item-emoji-avatar"]')).toBeTruthy();
    const card = container.querySelector('[data-testid="items-category-card-c1"]');
    expect(card).toBeTruthy();
    act(() => {
      (card as HTMLElement).click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("lets the avatar change emoji without opening the category", async () => {
    const onOpen = vi.fn();
    const onEmojiChange = vi.fn().mockResolvedValue(undefined);
    const summary: CategorySummary = {
      id: "c1",
      category: {
        id: "c1",
        name: "Food",
        slug: "food",
        sortOrder: 1,
        color: "#22C55E",
        emoji: "🍎",
        defaultRemindBeforeDays: 3,
        createdAt: null,
        updatedAt: null,
      },
      itemCount: 1,
      expiringCount: 0,
      overdueCount: 0,
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsCategoryCard
          summary={summary}
          onOpen={onOpen}
          onEmojiChange={onEmojiChange}
        />,
      );
    });

    const trigger = container.querySelector(
      '[data-testid="item-card-emoji-trigger"]',
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger.click();
    });
    expect(onOpen).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    const milk = document.querySelector(
      '[data-testid="emoji-option-🥛"]',
    ) as HTMLButtonElement;
    await act(async () => {
      milk.click();
    });

    expect(onEmojiChange).toHaveBeenCalledWith("🥛");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("does not expose emoji editing for synthetic all-types card", () => {
    const summary: CategorySummary = {
      id: "all",
      category: null,
      itemCount: 3,
      expiringCount: 0,
      overdueCount: 0,
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsCategoryCard
          summary={summary}
          title="All types"
          onOpen={vi.fn()}
          onEmojiChange={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="item-card-emoji-trigger"]')).toBeNull();
    expect(container.textContent).toContain("🗂️");
  });

  it("shows package fallback emoji when category has none", () => {
    const summary: CategorySummary = {
      id: "c2",
      category: {
        id: "c2",
        name: "Custom",
        slug: null,
        sortOrder: 2,
        color: null,
        emoji: null,
        defaultRemindBeforeDays: null,
        createdAt: null,
        updatedAt: null,
      },
      itemCount: 0,
      expiringCount: 0,
      overdueCount: 0,
    };

    act(() => {
      root = createRoot(container);
      root.render(<ItemsCategoryCard summary={summary} onOpen={vi.fn()} />);
    });

    expect(container.textContent).toContain("📦");
  });

  it("uses distinct all-types emoji (not clipboard / package)", () => {
    const summary: CategorySummary = {
      id: "all",
      category: null,
      itemCount: 3,
      expiringCount: 0,
      overdueCount: 0,
    };

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsCategoryCard summary={summary} title="All types" onOpen={vi.fn()} />,
      );
    });

    expect(container.textContent).toContain("🗂️");
    expect(container.textContent).not.toContain("📋");
  });

  it("uses category emoji as-is for insurance seed (no FE overlay)", () => {
    const summary: CategorySummary = {
      id: "seed_insurance",
      category: {
        id: "seed_insurance",
        name: "Insurance",
        slug: "insurance",
        sortOrder: 75,
        color: "#0EA5E9",
        emoji: "☂️",
        defaultRemindBeforeDays: 30,
        createdAt: null,
        updatedAt: null,
      },
      itemCount: 1,
      expiringCount: 0,
      overdueCount: 0,
    };

    act(() => {
      root = createRoot(container);
      root.render(<ItemsCategoryCard summary={summary} onOpen={vi.fn()} />);
    });

    expect(container.textContent).toContain("☂️");
  });
});
