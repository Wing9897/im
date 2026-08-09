/**
 * Unit tests for src/api/items.ts — path + query wiring only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./client";
import {
  createItem,
  createItemCategory,
  deleteItem,
  deleteItemCategory,
  getItem,
  listItemCategories,
  listItems,
  updateItem,
  updateItemCategory,
} from "./items";

vi.mock("./client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("items API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists categories", async () => {
    const rows = [{ id: "seed_food", name: "食物", sortOrder: 20 }];
    vi.mocked(apiClient.get).mockResolvedValue(rows);

    const result = await listItemCategories();

    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/items/categories");
    expect(result).toEqual(rows);
  });

  it("creates / patches / deletes a category (id encoded)", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ id: "c1" });
    vi.mocked(apiClient.patch).mockResolvedValue({ id: "c 1" });
    vi.mocked(apiClient.delete).mockResolvedValue({ ok: true });

    await createItemCategory({ name: "Custom", sortOrder: 1 });
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/items/categories", {
      name: "Custom",
      sortOrder: 1,
    });

    await updateItemCategory("c 1", { name: "Renamed" });
    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/items/categories/c%201", {
      name: "Renamed",
    });

    await deleteItemCategory("c 1");
    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/items/categories/c%201");
  });

  it("lists items with optional filters", async () => {
    vi.mocked(apiClient.get).mockResolvedValue([]);

    await listItems();
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/items", {});

    await listItems({
      worksetId: "__user__",
      categoryId: "seed_food",
      status: "active",
      search: "milk",
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/items", {
      worksetId: "__user__",
      categoryId: "seed_food",
      status: "active",
      search: "milk",
    });
  });

  it("fetches a single item by id (encoded)", async () => {
    const row = { id: "i1", title: "Milk" };
    vi.mocked(apiClient.get).mockResolvedValue(row);
    await expect(getItem("i 1")).resolves.toEqual(row);
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/items/i%201");
  });

  it("creates / patches / deletes an item (id encoded)", async () => {
    const created = { id: "i1", title: "Milk" };
    vi.mocked(apiClient.post).mockResolvedValue(created);
    vi.mocked(apiClient.patch).mockResolvedValue({ ...created, title: "Yogurt" });
    vi.mocked(apiClient.delete).mockResolvedValue({ ok: true });

    const body = {
      title: "Milk",
      worksetId: "__user__",
      categoryId: "seed_food",
      expiresAt: "2026-08-10",
      remindBeforeDays: 3,
      notes: "",
      status: "active",
      emoji: "🥛",
      attributes: { brand: "A" },
    };
    await expect(createItem(body)).resolves.toEqual(created);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/items", body);

    await updateItem("i 1", { title: "Yogurt" });
    expect(apiClient.patch).toHaveBeenCalledWith("/api/v1/items/i%201", { title: "Yogurt" });

    await deleteItem("i 1");
    expect(apiClient.delete).toHaveBeenCalledWith("/api/v1/items/i%201");
  });

  it("propagates transport errors", async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error("boom"));
    await expect(listItems()).rejects.toThrow("boom");
  });
});
