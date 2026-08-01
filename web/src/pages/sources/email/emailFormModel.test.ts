import { describe, expect, it } from "vitest";
import { MASKED_SECRET } from "../../../utils/configValidation";
import type { EmailMailboxInfo } from "../../../types";
import {
  formToPatch,
  mailboxToForm,
  parseDelimitedList,
} from "./emailFormModel";

describe("parseDelimitedList", () => {
  it("splits comma-separated values", () => {
    expect(parseDelimitedList("a, b ,c")).toEqual(["a", "b", "c"]);
  });

  it("splits newline-separated values", () => {
    expect(parseDelimitedList("INBOX\nSent\n")).toEqual(["INBOX", "Sent"]);
  });

  it("returns empty array for blank input", () => {
    expect(parseDelimitedList("  ,  \n  ")).toEqual([]);
  });
});

describe("formToPatch", () => {
  it("maps form fields to API patch payload", () => {
    const patch = formToPatch(
      {
        preset: "gmail",
        imapHost: "imap.gmail.com",
        imapPort: 993,
        useSsl: true,
        username: "user@gmail.com",
        password: "secret",
        foldersText: "INBOX, Sent",
        pollIntervalMinutes: 5,
        initialSyncDays: 7,
        initialSyncMaxMessages: 100,
        senderAllowlistText: "alerts@example.com",
        markAsRead: true,
      },
      true,
    );

    expect(patch).toEqual({
      imapHost: "imap.gmail.com",
      imapPort: 993,
      useSsl: true,
      username: "user@gmail.com",
      password: "secret",
      folders: ["INBOX", "Sent"],
      pollIntervalSeconds: 300,
      initialSyncDays: 7,
      initialSyncMaxMessages: 100,
      senderAllowlist: ["alerts@example.com"],
      markAsRead: true,
      resetCursors: true,
    });
  });

  it("omits password when masked secret is unchanged", () => {
    const patch = formToPatch(
      {
        preset: "custom",
        imapHost: "imap.example.com",
        imapPort: 993,
        useSsl: true,
        username: "user@example.com",
        password: MASKED_SECRET,
        foldersText: "INBOX",
        pollIntervalMinutes: 5,
        initialSyncDays: 7,
        initialSyncMaxMessages: 100,
        senderAllowlistText: "",
        markAsRead: false,
      },
      false,
    );

    expect(patch.password).toBeNull();
  });
});

describe("mailboxToForm", () => {
  it("maps mailbox info back to editable form fields", () => {
    const mailbox: EmailMailboxInfo = {
      account: {
        id: "email-1",
        platform: "email",
        name: "Alerts",
        status: "connected",
        lastError: null,
        lastConnectedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      imapHost: "imap.gmail.com",
      imapPort: 993,
      useSsl: true,
      username: "user@gmail.com",
      folders: ["INBOX", "Sent"],
      pollIntervalSeconds: 600,
      initialSyncDays: 14,
      initialSyncMaxMessages: 50,
      senderAllowlist: ["alerts@example.com"],
      markAsRead: true,
      folderCursors: { INBOX: 42 },
      channels: [],
      lastError: null,
      lastSuccessAt: "2026-01-02T00:00:00.000Z",
    };

    expect(mailboxToForm(mailbox)).toEqual({
      preset: "gmail",
      imapHost: "imap.gmail.com",
      imapPort: 993,
      useSsl: true,
      username: "user@gmail.com",
      password: MASKED_SECRET,
      foldersText: "INBOX\nSent",
      pollIntervalMinutes: 10,
      initialSyncDays: 14,
      initialSyncMaxMessages: 50,
      senderAllowlistText: "alerts@example.com",
      markAsRead: true,
    });
  });
});
