import type { EmailMailboxInfo, EmailMailboxPatch } from "../../../types";
import { MASKED_SECRET } from "../../../utils/configValidation";

export type EmailProviderPreset = "gmail" | "outlook" | "yahoo" | "custom";

export const EMAIL_PROVIDER_PRESETS: Record<
  EmailProviderPreset,
  { imapHost: string; imapPort: number; useSsl: boolean }
> = {
  gmail: { imapHost: "imap.gmail.com", imapPort: 993, useSsl: true },
  outlook: { imapHost: "outlook.office365.com", imapPort: 993, useSsl: true },
  yahoo: { imapHost: "imap.mail.yahoo.com", imapPort: 993, useSsl: true },
  custom: { imapHost: "", imapPort: 993, useSsl: true },
};

export interface EmailFormFields {
  preset: EmailProviderPreset;
  imapHost: string;
  imapPort: number;
  useSsl: boolean;
  username: string;
  password: string;
  foldersText: string;
  pollIntervalMinutes: number;
  initialSyncDays: number;
  initialSyncMaxMessages: number;
  senderAllowlistText: string;
  markAsRead: boolean;
}

export const INITIAL_EMAIL_FORM: EmailFormFields = {
  preset: "gmail",
  ...EMAIL_PROVIDER_PRESETS.gmail,
  username: "",
  password: "",
  foldersText: "INBOX",
  pollIntervalMinutes: 5,
  initialSyncDays: 7,
  initialSyncMaxMessages: 100,
  senderAllowlistText: "",
  markAsRead: false,
};

/** Split comma/newline delimited user input into a trimmed list. */
export function parseDelimitedList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function applyEmailPreset(
  current: EmailFormFields,
  preset: EmailProviderPreset,
): EmailFormFields {
  return {
    ...current,
    preset,
    ...EMAIL_PROVIDER_PRESETS[preset],
  };
}

export function formToPatch(form: EmailFormFields, resetCursors: boolean): EmailMailboxPatch {
  const password = form.password === MASKED_SECRET ? null : form.password || null;
  return {
    imapHost: form.imapHost.trim(),
    imapPort: form.imapPort,
    useSsl: form.useSsl,
    username: form.username.trim(),
    password,
    folders: parseDelimitedList(form.foldersText),
    pollIntervalSeconds: Math.round(form.pollIntervalMinutes * 60),
    initialSyncDays: form.initialSyncDays,
    initialSyncMaxMessages: form.initialSyncMaxMessages,
    senderAllowlist: parseDelimitedList(form.senderAllowlistText),
    markAsRead: form.markAsRead,
    resetCursors,
  };
}

export function formToCreatePayload(form: EmailFormFields): {
  imapHost: string;
  imapPort: number;
  useSsl: boolean;
  username: string;
  password: string;
  folders: string[];
  pollIntervalSeconds: number;
  initialSyncDays: number;
  initialSyncMaxMessages: number;
  senderAllowlist: string[];
  markAsRead: boolean;
} {
  return {
    imapHost: form.imapHost.trim(),
    imapPort: form.imapPort,
    useSsl: form.useSsl,
    username: form.username.trim(),
    password: form.password,
    folders: parseDelimitedList(form.foldersText),
    pollIntervalSeconds: Math.round(form.pollIntervalMinutes * 60),
    initialSyncDays: form.initialSyncDays,
    initialSyncMaxMessages: form.initialSyncMaxMessages,
    senderAllowlist: parseDelimitedList(form.senderAllowlistText),
    markAsRead: form.markAsRead,
  };
}

export function mailboxToForm(mailbox: EmailMailboxInfo): EmailFormFields {
  const presetEntry = Object.entries(EMAIL_PROVIDER_PRESETS).find(
    ([, value]) => value.imapHost === mailbox.imapHost,
  );
  return {
    preset: (presetEntry?.[0] as EmailProviderPreset | undefined) ?? "custom",
    imapHost: mailbox.imapHost,
    imapPort: mailbox.imapPort,
    useSsl: mailbox.useSsl,
    username: mailbox.username,
    password: MASKED_SECRET,
    foldersText: mailbox.folders.join("\n"),
    pollIntervalMinutes: Math.max(1, Math.round(mailbox.pollIntervalSeconds / 60)),
    initialSyncDays: mailbox.initialSyncDays,
    initialSyncMaxMessages: mailbox.initialSyncMaxMessages,
    senderAllowlistText: mailbox.senderAllowlist.join(", "),
    markAsRead: mailbox.markAsRead,
  };
}

export function formToValidationInput(form: EmailFormFields, isEdit: boolean) {
  return {
    imap_host: form.imapHost,
    imap_port: form.imapPort,
    username: form.username,
    password: form.password,
    folders: parseDelimitedList(form.foldersText),
    poll_interval_seconds: Math.round(form.pollIntervalMinutes * 60),
    initial_sync_days: form.initialSyncDays,
    initial_sync_max_messages: form.initialSyncMaxMessages,
    is_edit: isEdit,
  };
}
