import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../../types/worksets";
import type { ItemSaveDraft } from "./ItemForm";
import { toItemWriteBody } from "./itemFormSaveBody";

describe("toItemWriteBody", () => {
  it("omits form-only id so PATCH/POST bodies satisfy extra=forbid", () => {
    const draft: ItemSaveDraft = {
      id: "item-42",
      title: "Passport",
      worksetId: SYSTEM_WORKSET_ID,
      categoryId: "seed_passport_docs",
      notes: "renew",
      emoji: "🪪",
      quantity: 2,
      unit: "盒",
      status: "active",
    };
    expect(toItemWriteBody(draft)).toEqual({
      title: "Passport",
      worksetId: SYSTEM_WORKSET_ID,
      categoryId: "seed_passport_docs",
      notes: "renew",
      emoji: "🪪",
      quantity: 2,
      unit: "盒",
      status: "active",
    });
    expect(toItemWriteBody(draft)).not.toHaveProperty("id");
    expect(toItemWriteBody(draft)).not.toHaveProperty("price");
    expect(toItemWriteBody(draft)).not.toHaveProperty("attributes");
  });
});
