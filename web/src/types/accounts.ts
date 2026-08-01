// ============================================================
// Account Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";
import type { ConnectionStatus } from "./common";

/** A registered messaging platform account */
type AccountResponse = components["schemas"]["AccountResponse"];

/**
 * Account wire fields plus the frontend-only transient "connecting" status
 * applied while an adapter reconnect SSE is in flight.
 */
export type Account = Omit<AccountResponse, "status"> & {
  status: ConnectionStatus;
};

/** Credentials required to add a new account via phone code */
export type AccountCredentials = components["schemas"]["TelegramCredentials"];

/** Credentials required to add a new account via QR login */
export type TelegramQrCredentials =
  components["schemas"]["TelegramQrCredentials"];

/** Response from create_account / QR wait / submit_account_code / submit_account_2fa */
export type AddAccountResponse = components["schemas"]["AddAccountResponse"];

export type RefreshAllAccountsResponse =
  components["schemas"]["RefreshAllAccountsResponse"];
