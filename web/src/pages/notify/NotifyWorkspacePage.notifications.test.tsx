/**
 * Unit tests for UI renaming and channel-specific fields on NotifyWorkspacePage.
 *
 * ActionTypeSelector tile/label/create coverage lives in ActionTypeSelector.test.tsx.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockListActions, mockListTasks } = vi.hoisted(() => ({
  mockListActions: vi.fn(),
  mockListTasks: vi.fn(),
}));

vi.mock("../../api/actions", () => ({
  listActions: (...args: unknown[]) => mockListActions(...args),
  deleteAction: vi.fn().mockResolvedValue(undefined),
  toggleAction: vi.fn().mockResolvedValue(undefined),
  testAction: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("../../api/tasks", () => ({
  listTasks: (...args: unknown[]) => mockListTasks(...args),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));
vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

import { NotifyWorkspacePage } from "./NotifyWorkspacePage";

function renderNotifyWorkspacePage() {
  return createElement(MemoryRouter, null, createElement(NotifyWorkspacePage));
}

function setupDefaultMocks(): void {
  mockListActions.mockResolvedValue([]);
  mockListTasks.mockResolvedValue([]);
}

describe("UI Renaming - 通知", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockListActions.mockReset();
    mockListTasks.mockReset();
    setupDefaultMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  it("renders the page toolbar without a hero title", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderNotifyWorkspacePage());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector("h1")).toBeNull();
    const createButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent === "新增通知",
    );
    expect(createButton?.getAttribute("aria-label")).toBe("新增通知");
  });

  it("does not contain old terminology '自動動作' (Requirement 1.5)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderNotifyWorkspacePage());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("自動動作");
  });
});

describe("ActionFormDialog - channel-specific fields", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockListActions.mockReset();
    mockListTasks.mockReset();
    setupDefaultMocks();
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
  });

  async function openFormDialog() {
    await act(async () => {
      root = createRoot(container);
      root.render(renderNotifyWorkspacePage());
      await Promise.resolve();
      await Promise.resolve();
    });

    const createButton = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "新增通知",
    );
    await act(async () => {
      createButton!.click();
      await Promise.resolve();
    });
  }

  const pageText = () => document.body.textContent ?? "";

  it("shows no channel-specific fields when no channel is selected (create mode)", async () => {
    await openFormDialog();

    expect(pageText()).toContain("新增通知");
    expect(pageText()).not.toContain("Webhook URL");
    expect(pageText()).not.toContain("Broker URL");
    expect(pageText()).not.toContain("Bot Token");
  });

  function findChannelTile(label: string): HTMLButtonElement | undefined {
    return Array.from(document.body.querySelectorAll("button[aria-pressed]")).find(
      (btn) => btn.textContent?.includes(label),
    ) as HTMLButtonElement | undefined;
  }

  it("shows Discord fields when Discord Webhook is selected", async () => {
    await openFormDialog();

    const discordButton = findChannelTile("Discord Webhook");

    await act(async () => {
      discordButton!.click();
      await Promise.resolve();
    });

    expect(pageText()).toContain("Webhook URL");
  });

  it("shows HTTP Webhook fields when HTTP Webhook is selected", async () => {
    await openFormDialog();

    const httpButton = findChannelTile("HTTP Webhook");

    await act(async () => {
      httpButton!.click();
      await Promise.resolve();
    });

    expect(pageText()).toContain("URL");
    expect(pageText()).toContain("HTTP Method");
    expect(pageText()).toContain("Custom Headers");
  });

  it("shows MQTT fields when MQTT is selected", async () => {
    await openFormDialog();

    const mqttButton = findChannelTile("MQTT");

    await act(async () => {
      mqttButton!.click();
      await Promise.resolve();
    });

    expect(pageText()).toContain("Broker URL");
    expect(pageText()).toContain("Topic");
    expect(pageText()).toContain("Username");
    expect(pageText()).toContain("Password");
    expect(pageText()).toContain("QoS Level");
  });

  it("shows Telegram fields when Telegram Bot is selected", async () => {
    await openFormDialog();

    const telegramButton = findChannelTile("Telegram Bot");

    await act(async () => {
      telegramButton!.click();
      await Promise.resolve();
    });

    expect(pageText()).toContain("Bot Token");
    expect(pageText()).toContain("Chat ID");
  });
});
