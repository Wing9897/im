import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const { mockListItems, mockListUserEvents } = vi.hoisted(() => ({
  mockListItems: vi.fn(),
  mockListUserEvents: vi.fn(),
}));

vi.mock("../../../api/items", () => ({
  listItems: (...args: unknown[]) => mockListItems(...args),
}));

vi.mock("../../../api/userEvents", () => ({
  listUserEvents: (...args: unknown[]) => mockListUserEvents(...args),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

import { makeTrackableItem } from "../../../test/fixtures/trackableItem";
import { ItemsFinancePage } from "./ItemsFinancePage";

describe("ItemsFinancePage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    mockListItems.mockReset();
    mockListUserEvents.mockReset();
    mockListItems.mockResolvedValue([
      makeTrackableItem({ id: "i1", title: "相機", price: 500 }),
    ]);
    mockListUserEvents.mockResolvedValue([
      {
        id: "e1",
        title: "購入",
        startTime: "2026-08-05T10:00:00",
        itemId: "i1",
        dismissed: false,
        isAllDay: false,
        origin: "manual",
        worksetId: "__user__",
        createdAt: "",
        updatedAt: "",
      },
    ]);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    root = null;
  });

  it("renders toolbar and summary after load", async () => {
    root = createRoot(container);
    await act(async () => {
      root!.render(wrapWithI18n(createElement(ItemsFinancePage)));
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="items-finance-page"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="items-finance-toolbar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="items-finance-summary"]')).toBeTruthy();
  });
});
