import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "./emoji/emojiPickerReactMock";
import type { TrackableItem } from "../../api/items";
import { makeTrackableItem } from "../../test/fixtures/trackableItem";
import { ItemsEntryCard } from "./ItemsEntryCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (key === "openItemAria") return `Open ${opts?.name ?? ""}`;
      if (key === "editItemAria") return `Edit ${opts?.name ?? ""}`;
      if (key === "deleteItemAria") return `Delete ${opts?.name ?? ""}`;
      if (key === "editItem") return "Edit";
      if (key === "deleteItem") return "Delete";
      if (key === "duplicateItem") return "Duplicate";
      if (key === "duplicateItemAria") return `Duplicate ${opts?.name ?? ""}`;
      if (key === "changeEmojiAria") return `Change emoji for ${opts?.name ?? ""}`;
      if (key === "emojiPickerAria") return "Choose an emoji";
      if (key === "emojiClear") return "Clear";
      if (key === "emojiHint") return "hint";
      if (key === "done") return "Done";
      if (key === "dialog.close") return "Close";
      if (key === "daysLeft") return `${opts?.count ?? 0}d left`;
      if (key === "daysOverdue") return `${opts?.count ?? 0}d overdue`;
      if (key === "expiringSoon") return "Expiring soon";
      if (key === "noExpiry") return "No expiry";
      if (key === "linkedExpiryOn") return `Expires ${opts?.date ?? ""}`;
      if (key === "statusArchived") return "Archived";
      if (key === "archive") return "Archive";
      if (key === "unarchive") return "Unarchive";
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
  return makeTrackableItem({
    worksetId: "ws-1",
    remindBeforeDays: 7,
    ...partial,
  });
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

  it("renders emoji avatar, linked expiry subtitle, badge, and opens on click", () => {
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
    expect(container.textContent).toContain("Expiring soon");
    expect(container.textContent).toContain(`Expires ${expiresAt}`);
    expect(container.querySelector('[data-testid="item-emoji-avatar"]')).toBeTruthy();

    const card = container.querySelector('[data-testid="items-entry-card-i1"]');
    expect(card).toBeTruthy();
    act(() => {
      (card as HTMLElement).click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows no-expiry subtitle without a redundant badge", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({ id: "i0", title: "Spare" })}
          emoji="📦"
          onOpen={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("No expiry");
    expect(container.textContent?.match(/No expiry/g)?.length).toBe(1);
  });

  it("does not render linked calendar event titles as card badges", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({
            id: "i3",
            title: "Milk",
            expiresAt: isoDaysFromNow(1),
          })}
          emoji="🥛"
          categoryLabel="Food"
          onOpen={vi.fn()}
        />,
      );
    });

    // Day-count + category only — not milestone titles like「到期」or long event names.
    expect(container.textContent).toContain("Expiring soon");
    expect(container.textContent).toContain("Food");
    expect(container.textContent).not.toContain("到期");
    expect(container.textContent).not.toContain("Expires event with a very long calendar title");
  });

  it("shows no day badge when expiresAt is null (orphan cache cleared / no linked到期)", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({
            id: "i4",
            title: "No link",
            expiresAt: null,
            remindBeforeDays: 7,
          })}
          emoji="📦"
          categoryLabel="未分類"
          onOpen={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain("No expiry");
    expect(container.textContent).toContain("未分類");
    expect(container.textContent).not.toMatch(/\d+d left/);
    expect(container.textContent).not.toMatch(/\d+d overdue/);
  });

  it("changes emoji from the avatar without opening the item", async () => {
    const onOpen = vi.fn();
    const onEmojiChange = vi.fn().mockResolvedValue(undefined);

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({ id: "i1", title: "Milk" })}
          emoji="🥛"
          onOpen={onOpen}
          onEmojiChange={onEmojiChange}
        />,
      );
    });

    const trigger = container.querySelector(
      '[data-testid="item-card-emoji-trigger"]',
    ) as HTMLButtonElement;
    await act(async () => {
      trigger.click();
    });
    expect(onOpen).not.toHaveBeenCalled();

    await act(async () => {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
    });

    const apple = document.querySelector(
      '[data-testid="emoji-option-🍎"]',
    ) as HTMLButtonElement;
    await act(async () => {
      apple.click();
    });

    expect(onEmojiChange).toHaveBeenCalledWith("🍎");
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows overdue tone copy and icon actions without opening the card", () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
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
          onArchive={onArchive}
          onDelete={onDelete}
        />,
      );
    });

    expect(container.textContent).toContain("3d overdue");
    expect(container.textContent).toContain("Archived");

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="items-entry-archive-i2"]')!.click();
    });
    expect(onArchive).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="items-entry-edit-i2"]')!.click();
    });
    expect(onOpen).toHaveBeenCalledTimes(1);

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="items-entry-delete-i2"]')!.click();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("fires duplicate without opening the card", () => {
    const onOpen = vi.fn();
    const onDuplicate = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({ id: "i5", title: "Gadget" })}
          emoji="📦"
          onOpen={onOpen}
          onDuplicate={onDuplicate}
        />,
      );
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="items-entry-duplicate-i5"]')!.click();
    });
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shows inventory summary when quantity, unit, or price are set", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <ItemsEntryCard
          item={item({
            id: "i3",
            title: "Stock",
            quantity: 3,
            unit: "盒",
            price: 1280,
          })}
          emoji="📦"
          onOpen={vi.fn()}
        />,
      );
    });

    const line = container.querySelector('[data-testid="items-entry-inventory-i3"]');
    expect(line).not.toBeNull();
    expect(line?.textContent).toContain("× 3 盒");
    expect(line?.textContent).toContain("$ 1,280");
  });
});
