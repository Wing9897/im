import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Source, EmailMailboxInfo } from "../../../types";
import { useEmailTab } from "./useEmailTab";

vi.mock("../../../api/sources", () => ({
  createEmailMailbox: vi.fn(),
  deleteSource: vi.fn(),
  listEmailMailboxes: vi.fn(),
  updateEmailMailbox: vi.fn(),
}));

import {
  createEmailMailbox,
  deleteSource,
  listEmailMailboxes,
  updateEmailMailbox,
} from "../../../api/sources";

let latest: ReturnType<typeof useEmailTab> | null = null;

function Harness() {
  latest = useEmailTab();
  return null;
}

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: "email-1",
    platform: "email",
    name: "user@gmail.com",
    status: "connected",
    lastError: null,
    lastConnectedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeMailbox(overrides: Partial<EmailMailboxInfo> = {}): EmailMailboxInfo {
  return {
    source: makeSource(),
    imapHost: "imap.gmail.com",
    imapPort: 993,
    useSsl: true,
    username: "user@gmail.com",
    folders: ["INBOX"],
    pollIntervalSeconds: 300,
    initialSyncDays: 7,
    initialSyncMaxMessages: 100,
    senderAllowlist: [],
    markAsRead: false,
    folderCursors: {},
    channels: [],
    lastError: null,
    lastSuccessAt: null,
    ...overrides,
  };
}

describe("useEmailTab", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    vi.clearAllMocks();
    vi.mocked(listEmailMailboxes).mockResolvedValue([]);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("loads mailboxes on mount", async () => {
    const mailbox = makeMailbox();
    vi.mocked(listEmailMailboxes).mockResolvedValue([mailbox]);

    act(() => {
      root.render(<Harness />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(listEmailMailboxes).toHaveBeenCalled();
    expect(latest!.mailboxes).toEqual([mailbox]);
    expect(latest!.initialLoading).toBe(false);
  });

  it("creates a mailbox and refreshes the list", async () => {
    vi.mocked(createEmailMailbox).mockResolvedValue({
      source: makeSource(),
      status: "connected",
      errorMessage: null,
      channels: [],
    });
    vi.mocked(listEmailMailboxes).mockResolvedValue([]);

    act(() => {
      root.render(<Harness />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latest!.setForm((current) => ({
        ...current,
        username: "user@gmail.com",
        password: "app-password",
      }));
    });

    await act(async () => {
      await latest!.handleAddMailbox();
    });

    expect(createEmailMailbox).toHaveBeenCalledWith(
      expect.objectContaining({
        imapHost: "imap.gmail.com",
        username: "user@gmail.com",
        password: "app-password",
      }),
    );
    expect(listEmailMailboxes).toHaveBeenCalledTimes(2);
  });

  it("opens edit dialog and saves patch", async () => {
    const mailbox = makeMailbox();
    vi.mocked(listEmailMailboxes)
      .mockResolvedValueOnce([mailbox])
      .mockResolvedValueOnce([mailbox]);
    vi.mocked(updateEmailMailbox).mockResolvedValue({
      source: mailbox.source,
      status: "connected",
      errorMessage: null,
      channels: [],
    });

    act(() => {
      root.render(<Harness />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latest!.openEditDialog(mailbox);
    });

    expect(latest!.editTarget).toEqual(mailbox);
    expect(latest!.editForm).not.toBeNull();

    act(() => {
      latest!.setEditForm((current) =>
        current ? { ...current, pollIntervalMinutes: 10 } : current,
      );
    });

    await act(async () => {
      await latest!.handleSaveEdit();
    });

    expect(updateEmailMailbox).toHaveBeenCalledWith(
      mailbox.source.id,
      expect.objectContaining({ pollIntervalSeconds: 600 }),
    );
    expect(latest!.editTarget).toBeNull();
  });

  it("removes a mailbox via deleteSource", async () => {
    const mailbox = makeMailbox();
    vi.mocked(listEmailMailboxes).mockResolvedValue([mailbox]);
    vi.mocked(deleteSource).mockResolvedValue(undefined);

    act(() => {
      root.render(<Harness />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      latest!.setRemoveTarget(mailbox);
    });

    await act(async () => {
      await latest!.handleRemoveMailbox();
    });

    expect(deleteSource).toHaveBeenCalledWith(mailbox.source.id);
    expect(latest!.removeTarget).toBeNull();
  });
});
