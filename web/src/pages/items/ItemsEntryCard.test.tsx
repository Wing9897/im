import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrackableItem } from "../../api/items";
import { ItemsEntryCard } from "./ItemsEntryCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "openItemAria") return `Open ${opts?.name ?? ""}`;
      if (key === "daysLeft") return `${opts?.count ?? 0}d left`;
      if (key === "daysOverdue") return `${opts?.count ?? 0}d overdue`;
      if (key === "noExpiry") return "No expiry";
      if (key === "statusArchived") return "Archived";
      return key;
    },
  }),
}));

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function item(partial: Partial<TrackableItem> & { id: string; title: string }): TrackableItem {
  return {
    worksetId: "ws-1",
    categoryId: null,
    purchasedAt: null,
    expiresAt: null,
    remindBeforeDays: 7,
    notes: "",
    status: "active",
    attributes: {},
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("ItemsEntryCard", () => {
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

  it("renders emoji, expiry badge, and opens on click", () => {
    const onOpen = vi.fn();
    const expiresAt = isoDaysFromNow(2);

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({ id: "i1", title: "Milk", expiresAt })}
          emoji="🥛"
          categoryLabel="Food"
          onOpen={onOpen}
        />,
      );
    });

    expect(container.textContent).toContain("🥛");
    expect(container.textContent).toContain("Milk");
    expect(container.textContent).toContain("Food");
    expect(container.textContent).toContain("2d left");
    expect(container.textContent).toContain(expiresAt);

    const card = container.querySelector('[data-testid="items-entry-card-i1"]');
    expect(card).toBeTruthy();
    act(() => {
      (card as HTMLElement).click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows overdue tone copy and keeps actions from opening the card", () => {
    const onOpen = vi.fn();
    const onArchive = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({
            id: "i2",
            title: "Passport",
            expiresAt: isoDaysFromNow(-3),
            status: "archived",
          })}
          emoji="🛂"
          onOpen={onOpen}
          actions={
            <button type="button" data-testid="archive-btn" onClick={onArchive}>
              archive
            </button>
          }
        />,
      );
    });

    expect(container.textContent).toContain("3d overdue");
    expect(container.textContent).toContain("Archived");

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="archive-btn"]')!.click();
    });
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
