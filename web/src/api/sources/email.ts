/** Email (IMAP) mailbox source management. */

import { apiClient } from "../client";
import type { components } from "../generated/schema";
import type { AddEmailMailboxResponse, EmailMailboxInfo, EmailMailboxPatch } from "../../types";

type EmailMailboxBody = components["schemas"]["EmailMailboxBody"];
type RequiredEmailMailboxFields = "imapHost" | "username" | "password";
type CreateEmailMailboxParams = Pick<
  EmailMailboxBody,
  RequiredEmailMailboxFields
> &
  Partial<Omit<EmailMailboxBody, RequiredEmailMailboxFields>>;

/** Creates a new IMAP email mailbox source. */
export function createEmailMailbox(
  params: CreateEmailMailboxParams,
): Promise<AddEmailMailboxResponse> {
  return apiClient.post<AddEmailMailboxResponse>("/api/v1/sources/email", params);
}

/** Updates an existing IMAP email mailbox and reconnects. */
export function updateEmailMailbox(
  sourceId: string,
  params: EmailMailboxPatch,
): Promise<AddEmailMailboxResponse> {
  return apiClient.patch<AddEmailMailboxResponse>(
    `/api/v1/sources/email/${sourceId}`,
    params,
  );
}

/** Fetches all registered email mailbox sources. */
export function listEmailMailboxes(): Promise<EmailMailboxInfo[]> {
  return apiClient.get<EmailMailboxInfo[]>("/api/v1/sources/email");
}
