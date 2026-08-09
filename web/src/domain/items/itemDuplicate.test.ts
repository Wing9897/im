import { describe, expect, it } from "vitest";
import { buildDuplicateItemBody } from "./itemDuplicate";

describe("buildDuplicateItemBody", () => {
  it("copies scalar fields with a title suffix and omits date cache", () => {
    const body = buildDuplicateItemBody(
      {
        id: "src-1",
        title: "Milk",
        worksetId: "ws-1",
        categoryId: "cat-1",
        notes: "Keep cold",
        emoji: "🥛",
        quantity: 2,
        unit: "盒",
        price: 48,
        attributes: { brand: "Local" },
        status: "archived",
        expiresAt: "2026-12-01",
        remindBeforeDays: 7,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-02T00:00:00Z",
      },
      " (copy)",
    );

    expect(body).toEqual({
      title: "Milk (copy)",
      worksetId: "ws-1",
      categoryId: "cat-1",
      notes: "Keep cold",
      emoji: "🥛",
      quantity: 2,
      unit: "盒",
      price: 48,
      attributes: { brand: "Local" },
      status: "active",
    });
    expect(body).not.toHaveProperty("expiresAt");
    expect(body).not.toHaveProperty("remindBeforeDays");
    expect(body).not.toHaveProperty("id");
  });
});
