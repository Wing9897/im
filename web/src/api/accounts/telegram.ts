/** Telegram account registration and login-verification flow. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type {
  Account,
  AccountCredentials,
  AddAccountResponse,
  TelegramQrCredentials,
} from "../../types";

type TelegramAccountPatch = components["schemas"]["TelegramPatchBody"];
type TelegramQrWaitBody = components["schemas"]["TelegramQrWaitBody"];
type TelegramCodeBody = components["schemas"]["TelegramCodeBody"];
type Telegram2faBody = components["schemas"]["Telegram2faBody"];
type UpdateTelegramAccountResponse =
  components["schemas"]["UpdateTelegramAccountResponse"];

/** Typed Telegram account list (`GET /accounts/telegram`). */
export function listTelegramAccounts(): Promise<Account[]> {
  return apiClient.get<Account[]>("/api/v1/accounts/telegram");
}

/** Initiates Telegram account registration with the given credentials. */
export function createTelegramAccount(
  credentials: AccountCredentials,
): Promise<AddAccountResponse> {
  return apiClient.post<AddAccountResponse>("/api/v1/accounts/telegram", credentials);
}

/** Initiates Telegram account registration via QR login. */
export function createTelegramQrAccount(
  credentials: TelegramQrCredentials,
): Promise<AddAccountResponse> {
  return apiClient.post<AddAccountResponse>("/api/v1/accounts/telegram/qr", credentials);
}

/** Long-polls until QR is scanned, refreshed, needs 2FA, or connects. */
export function waitTelegramQrLogin(
  accountId: string,
  params?: TelegramQrWaitBody,
): Promise<AddAccountResponse> {
  // Server may hold up to ~55s; default HTTP timeout (30s) aborts mid-wait and
  // surfaces as「請求逾時」even after a successful phone scan.
  return apiClient.post<AddAccountResponse>(
    `/api/v1/accounts/telegram/${accountId}/qr-wait`,
    params ?? {},
    { timeoutMs: 90_000 },
  );
}

/** Updates display name and/or stored Telegram credentials. */
export function updateTelegramAccount(
  accountId: string,
  patch: TelegramAccountPatch,
): Promise<UpdateTelegramAccountResponse> {
  return apiClient.patch<UpdateTelegramAccountResponse>(
    `/api/v1/accounts/telegram/${accountId}`,
    patch,
  );
}

/** Submits a verification code during Telegram login flow. */
export function submitTelegramCode(
  accountId: string,
  params: TelegramCodeBody,
): Promise<AddAccountResponse> {
  return apiClient.post<AddAccountResponse>(
    `/api/v1/accounts/telegram/${accountId}/verify-code`,
    params,
  );
}

/** Submits a two-factor authentication password during Telegram login flow. */
export function submitTelegram2fa(
  accountId: string,
  params: Telegram2faBody,
): Promise<AddAccountResponse> {
  return apiClient.post<AddAccountResponse>(
    `/api/v1/accounts/telegram/${accountId}/verify-2fa`,
    params,
  );
}
