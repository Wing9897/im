import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItemsCategoryCard } from "./ItemsCategoryCard";
import type { CategorySummary } from "../../domain/items/categoryAggregates";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "categoryItemCount") return `${opts?.count ?? 0} items`;
      if (key === "categoryExpiringCount") return `${opts?.count ?? 0} soon`;
      if (key === "categoryOverdueCount") return `${opts?.count ?? 0} overdue`;
      if (key === "openCategoryAria") return `Open ${opts?.name ?? ""}`;
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
        fieldSchema: [],
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
    const card = container.querySelector('[data-testid="items-category-card-c1"]');
    expect(card).toBeTruthy();
    act(() => {
      (card as HTMLElement).click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
