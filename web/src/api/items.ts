/**
 * REST client for trackable items + soft-template categories.
 *
 * Transport stays hand-written; response/body shapes align with OpenAPI
 * ``components["schemas"]`` (same style as tasks.ts).
 */

import { apiClient } from "./client";
import type { components } from "./generated/schema";

export type ItemFieldSchemaEntry = components["schemas"]["ItemFieldSchemaEntry"];
export type ItemCategory = components["schemas"]["ItemCategoryResponse"];
export type TrackableItem = components["schemas"]["ItemResponse"];
export type ItemWriteParams = components["schemas"]["ItemCreateBody"];
export type CategoryWriteParams = components["schemas"]["CategoryCreateBody"];

export type ItemStatus = TrackableItem["status"];

export function listItemCategories(): Promise<ItemCategory[]> {
  return apiClient.get<ItemCategory[]>("/api/v1/items/categories");
}

export function createItemCategory(params: CategoryWriteParams): Promise<ItemCategory> {
  return apiClient.post<ItemCategory>("/api/v1/items/categories", params);
}

export function updateItemCategory(
  id: string,
  params: Partial<components["schemas"]["CategoryUpdateBody"]>,
): Promise<ItemCategory> {
  return apiClient.patch<ItemCategory>(`/api/v1/items/categories/${encodeURIComponent(id)}`, params);
}

export function deleteItemCategory(id: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/api/v1/items/categories/${encodeURIComponent(id)}`);
}

export function listItems(params?: {
  worksetId?: string;
  categoryId?: string;
  status?: ItemStatus;
  search?: string;
}): Promise<TrackableItem[]> {
  const query: Record<string, string> = {};
  if (params?.worksetId) query.worksetId = params.worksetId;
  if (params?.categoryId !== undefined) query.categoryId = params.categoryId;
  if (params?.status) query.status = params.status;
  if (params?.search) query.search = params.search;
  return apiClient.get<TrackableItem[]>("/api/v1/items", query);
}

export function createItem(params: ItemWriteParams): Promise<TrackableItem> {
  return apiClient.post<TrackableItem>("/api/v1/items", params);
}

export function updateItem(
  id: string,
  params: Partial<components["schemas"]["ItemUpdateBody"]>,
): Promise<TrackableItem> {
  return apiClient.patch<TrackableItem>(`/api/v1/items/${encodeURIComponent(id)}`, params);
}

export function deleteItem(id: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/api/v1/items/${encodeURIComponent(id)}`);
}
