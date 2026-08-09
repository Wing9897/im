import type { ItemWriteParams } from "../../../api/items";
import type { ItemSaveDraft } from "./ItemForm";

/**
 * Map form draft → item create/update wire body.
 * Drops form-only `id` (path param on update); API schemas use extra=forbid.
 */
export function toItemWriteBody(draft: ItemSaveDraft): ItemWriteParams {
  const { id: _id, ...body } = draft;
  return body;
}
