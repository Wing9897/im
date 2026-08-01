/**
 * Unit tests for UI renaming and channel selector.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2
 *
 * Tests:
 * - "通知" heading is displayed
 * - "通知" terminology is used consistently (button says "新增通知")
 * - Empty state shows "尚未設定任何通知"
 * - ActionTypeSelector renders exactly 4 options with correct labels
 * - No channel is pre-selected in create mode
 * - Correct fields appear for each channel type
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                      */
/* ------------------------------------------------------------------ */

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

import { ActionsPage } from "./ActionsPage";
import { ActionTypeSelector } from "./ActionTypeSelector";

function renderActionsPage() {
  return createElement(MemoryRouter, null, createElement(ActionsPage));
}

/* ------------------------------------------------------------------ */
/*  Default mock setup — returns empty/default data for all commands    */
/* ------------------------------------------------------------------ */

function setupDefaultMocks(): void {
  mockListActions.mockResolvedValue([]);
  mockListTasks.mockResolvedValue([]);
}

/* ------------------------------------------------------------------ */
/*  Tests: UI Renaming (Requirements 1.1, 1.2, 1.3)                    */
/* ------------------------------------------------------------------ */

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
      root.render(renderActionsPage());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("新增通知");
    expect(container.textContent).toContain("通知規則");
    expect(container.querySelector("h1")).toBeNull();
  });

  it("uses '通知' terminology - button says '新增通知' (Requirement 1.2)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderActionsPage());
      await Promise.resolve();
      await Promise.resolve();
    });

    const buttons = container.querySelectorAll("button");
    const createButton = Array.from(buttons).find(
      (btn) => btn.textContent === "新增通知",
    );
    expect(createButton).not.toBeUndefined();
    expect(createButton!.getAttribute("aria-label")).toBe("新增通知");
  });

  it("displays '尚未設定任何通知' as empty state title (Requirement 1.3)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderActionsPage());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("尚未設定任何通知");
  });

  it("does not contain old terminology '自動動作' (Requirement 1.5)", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(renderActionsPage());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain("自動動作");
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: ActionTypeSelector (Requirements 2.1, 2.2)                     */
/* ------------------------------------------------------------------ */

describe("ActionTypeSelector", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
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

  function getChannelTiles(): HTMLButtonElement[] {
    return Array.from(document.body.querySelectorAll("button[aria-pressed]"));
  }

  it("renders exactly 4 channel options (Requirement 2.1)", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(createElement(ActionTypeSelector, { value: null, onChange }));
    });

    expect(getChannelTiles().length).toBe(4);
  });

  it("renders correct labels: Telegram Bot, Discord Webhook, HTTP Webhook, MQTT (Requirement 2.1)", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(createElement(ActionTypeSelector, { value: null, onChange }));
    });

    const labels = getChannelTiles().map((btn) => btn.textContent?.trim());

    expect(labels).toContain("Telegram Bot");
    expect(labels).toContain("Discord Webhook");
    expect(labels).toContain("HTTP Webhook");
    expect(labels).toContain("MQTT");
  });

  it("has no channel pre-selected in create mode (value=null) (Requirement 2.2)", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(createElement(ActionTypeSelector, { value: null, onChange }));
    });

    const selectedButtons = getChannelTiles().filter(
      (btn) => btn.getAttribute("aria-pressed") === "true",
    );

    expect(selectedButtons.length).toBe(0);
  });

  it("marks the correct option as selected when value is provided", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(
        createElement(ActionTypeSelector, { value: "discord_webhook", onChange }),
      );
    });

    const selectedButtons = getChannelTiles().filter(
      (btn) => btn.getAttribute("aria-pressed") === "true",
    );

    expect(selectedButtons.length).toBe(1);
    expect(selectedButtons[0].textContent).toContain("Discord Webhook");
  });

  it("calls onChange when a channel option is clicked", () => {
    const onChange = vi.fn();

    act(() => {
      root = createRoot(container);
      root.render(createElement(ActionTypeSelector, { value: null, onChange }));
    });

    const mqttButton = getChannelTiles().find((btn) =>
      btn.textContent?.includes("MQTT"),
    ) as HTMLElement | undefined;

    act(() => {
      mqttButton!.click();
    });

    expect(onChange).toHaveBeenCalledWith("mqtt");
  });
});

/* ------------------------------------------------------------------ */
/*  Tests: Channel-specific fields in form (Requirements 2.2, 2.3)     */
/* ------------------------------------------------------------------ */

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
      root.render(renderActionsPage());
      await Promise.resolve();
      await Promise.resolve();
    });

    // Click the "新增通知" button to open the form
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

    // The form should be open with the dialog title
    expect(pageText()).toContain("新增通知");

    // No channel-specific fields should be visible
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

    // Discord-specific field should appear
    expect(pageText()).toContain("Webhook URL");
  });

  it("shows HTTP Webhook fields when HTTP Webhook is selected", async () => {
    await openFormDialog();

    const httpButton = findChannelTile("HTTP Webhook");

    await act(async () => {
      httpButton!.click();
      await Promise.resolve();
    });

    // HTTP-specific fields should appear
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

    // MQTT-specific fields should appear
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

    // Telegram-specific fields should appear
    expect(pageText()).toContain("Bot Token");
    expect(pageText()).toContain("Chat ID");
  });
});

