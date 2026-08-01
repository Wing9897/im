/** Platform-agnostic account CRUD (list / delete / reconnect / refresh). */

import { apiClient } from "../client";
import type { Account, AddAccountResponse, RefreshAllAccountsResponse } from "../../types";

/** Fetches all registered accounts as Account[]. */
export function listAccounts(): Promise<Account[]> {
  return apiClient.get<Account[]>("/api/v1/accounts");
}

/** Removes an account and its associated data by ID. */
export function deleteAccount(accountId: string): Promise<void> {
  return apiClient.delete<void>(`/api/v1/accounts/${accountId}`);
}

/** Attempts to reconnect a disconnected account. */
export function reconnectAccount(accountId: string): Promise<AddAccountResponse> {
  return apiClient.post<AddAccountResponse>(
    `/api/v1/accounts/${accountId}/reconnect`,
  );
}

/** Triggers a refresh of all registered accounts' connection status. */
export function refreshAllAccounts(): Promise<RefreshAllAccountsResponse> {
  return apiClient.post<RefreshAllAccountsResponse>(
    "/api/v1/accounts/refresh-all",
  );
}
