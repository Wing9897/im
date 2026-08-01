/**
 * Shared public (unauthenticated / setup) JSON fetch with structured error parsing.
 */

import { resolveBaseUrl } from "./baseUrl";
import {
  ApiRequestError,
  parseErrorResponse,
} from "./parseApiError";

export async function publicFetchJson<T>(
  path: string,
  init?: RequestInit & { baseUrl?: string },
): Promise<T> {
  const base = (init?.baseUrl ?? resolveBaseUrl()).replace(/\/+$/, "");
  const url = new URL(path, `${base}/`).toString();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.body !== undefined && init.body !== null) {
    headers["Content-Type"] = "application/json";
  }
  const response = await fetch(url, {
    ...init,
    headers,
  });
  if (response.status === 204) {
    return undefined as T;
  }
  if (!response.ok) {
    const { apiError, structured } = await parseErrorResponse(response);
    throw new ApiRequestError(response.status, apiError, structured);
  }
  return (await response.json()) as T;
}
