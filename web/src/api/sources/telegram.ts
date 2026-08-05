/** Telegram source registration and login-verification flow. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type {
  Source,
  SourceCredentials,
  AddSourceResponse,
  TelegramQrCredentials,
} from "../../types";

type TelegramSourcePatch = components["schemas"]["TelegramPatchBody"];
type TelegramQrWaitBody = components["schemas"]["TelegramQrWaitBody"];
type TelegramCodeBody = components["schemas"]["TelegramCodeBody"];
type Telegram2faBody = components["schemas"]["Telegram2faBody"];
type UpdateTelegramSourceResponse =
  components["schemas"]["UpdateTelegramSourceResponse"];

/** Typed Telegram source list (`GET /sources/telegram`). */
export function listTelegramSources(): Promise<Source[]> {
  return apiClient.get<Source[]>("/api/v1/sources/telegram");
}

/** Initiates Telegram source registration with the given credentials. */
export function createTelegramSource(
  credentials: SourceCredentials,
): Promise<AddSourceResponse> {
  return apiClient.post<AddSourceResponse>("/api/v1/sources/telegram", credentials);
}

/** Initiates Telegram source registration via QR login. */
export function createTelegramQrSource(
  credentials: TelegramQrCredentials,
): Promise<AddSourceResponse> {
  return apiClient.post<AddSourceResponse>("/api/v1/sources/telegram/qr", credentials);
}

/** Long-polls until QR is scanned, refreshed, needs 2FA, or connects. */
export function waitTelegramQrLogin(
  sourceId: string,
  params?: TelegramQrWaitBody,
): Promise<AddSourceResponse> {
  // Server may hold up to ~55s; default HTTP timeout (30s) aborts mid-wait and
  // surfaces as「請求逾時」even after a successful phone scan.
  return apiClient.post<AddSourceResponse>(
    `/api/v1/sources/telegram/${sourceId}/qr-wait`,
    params ?? {},
    { timeoutMs: 90_000 },
  );
}

/** Updates display name and/or stored Telegram credentials. */
export function updateTelegramSource(
  sourceId: string,
  patch: TelegramSourcePatch,
): Promise<UpdateTelegramSourceResponse> {
  return apiClient.patch<UpdateTelegramSourceResponse>(
    `/api/v1/sources/telegram/${sourceId}`,
    patch,
  );
}

/** Submits a verification code during Telegram login flow. */
export function submitTelegramCode(
  sourceId: string,
  params: TelegramCodeBody,
): Promise<AddSourceResponse> {
  return apiClient.post<AddSourceResponse>(
    `/api/v1/sources/telegram/${sourceId}/verify-code`,
    params,
  );
}

/** Submits a two-factor authentication password during Telegram login flow. */
export function submitTelegram2fa(
  sourceId: string,
  params: Telegram2faBody,
): Promise<AddSourceResponse> {
  return apiClient.post<AddSourceResponse>(
    `/api/v1/sources/telegram/${sourceId}/verify-2fa`,
    params,
  );
}
