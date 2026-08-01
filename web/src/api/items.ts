/**
 * REST client for trackable items + soft-template categories.
 */

import { apiClient } from "./client";

export type ItemFieldSchemaEntry = {
  key: string;
  label: string;
};

export type ItemCategory = {
  id: string;
  name: string;
  slug?: string | null;
  sortOrder: number;
  color?: string | null;
  fieldSchema: ItemFieldSchemaEntry[];
  defaultRemindBeforeDays?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ItemStatus = "active" | "archived";

export type TrackableItem = {
  id: string;
  title: string;
  categoryId?: string | null;
  worksetId: string;
  purchasedAt?: string | null;
  expiresAt?: string | null;
  remindBeforeDays?: number | null;
  notes: string;
  status: ItemStatus;
  attributes: Record<string, string>;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ItemWriteParams = {
  title: string;
  worksetId?: string | null;
  categoryId?: string | null;
  purchasedAt?: string | null;
  expiresAt?: string | null;
  remindBeforeDays?: number | null;
  notes?: string;
  status?: ItemStatus;
  attributes?: Record<string, string>;
};

export type CategoryWriteParams = {
  name: string;
  slug?: string | null;
  sortOrder?: number;
  color?: string | null;
  fieldSchema?: ItemFieldSchemaEntry[];
  defaultRemindBeforeDays?: number | null;
};

export function listItemCategories(): Promise<ItemCategory[]> {
  return apiClient.get<ItemCategory[]>("/api/v1/items/categories");
}

export function createItemCategory(params: CategoryWriteParams): Promise<ItemCategory> {
  return apiClient.post<ItemCategory>("/api/v1/items/categories", params);
}

export function updateItemCategory(
  id: string,
  params: Partial<CategoryWriteParams>,
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

export function updateItem(id: string, params: Partial<ItemWriteParams>): Promise<TrackableItem> {
  return apiClient.patch<TrackableItem>(`/api/v1/items/${encodeURIComponent(id)}`, params);
}

export function deleteItem(id: string): Promise<{ ok: boolean }> {
  return apiClient.delete<{ ok: boolean }>(`/api/v1/items/${encodeURIComponent(id)}`);
}
