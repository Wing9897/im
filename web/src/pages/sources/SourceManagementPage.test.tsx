/**
 * Smoke test for SourceManagementPage rendering.
 *
 * Validates: Requirements 13.1, 13.3, 12.2, 12.3, 12.4
 *
 * Verifies that the component renders without throwing exceptions
 * when REST API calls are mocked to return empty/default data.
 * Also verifies visual polish: tab states, card hover, form input styles.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/*  Hoisted mocks                                                      */
/* ------------------------------------------------------------------ */

const {
  mockListTelegramAccounts,
  mockListDiscordBots,
  mockListRssFeeds,
  mockListHttpSources,
  mockListMqttBrokers,
  mockListEmailMailboxes,
  mockFetchAccessKeys,
  mockFetchSystemSettings,
} = vi.hoisted(() => ({
  mockListTelegramAccounts: vi.fn(),
  mockListDiscordBots: vi.fn(),
  mockListRssFeeds: vi.fn(),
  mockListHttpSources: vi.fn(),
  mockListMqttBrokers: vi.fn(),
  mockListEmailMailboxes: vi.fn(),
  mockFetchAccessKeys: vi.fn(),
  mockFetchSystemSettings: vi.fn(),
}));

vi.mock("../../api/accounts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/accounts")>();
  return {
    ...actual,
    listTelegramAccounts: mockListTelegramAccounts,
    listDiscordBots: mockListDiscordBots,
    listRssFeeds: mockListRssFeeds,
    listHttpSources: mockListHttpSources,
    listMqttBrokers: mockListMqttBrokers,
    listEmailMailboxes: mockListEmailMailboxes,
  };
});

vi.mock("../../api/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/config")>();
  return {
    ...actual,
    fetchSystemSettings: mockFetchSystemSettings,
  };
});

vi.mock("../../api/accessKeys", () => ({
  fetchAccessKeys: mockFetchAccessKeys,
  createAccessKey: vi.fn(),
  revokeAccessKey: vi.fn(),
}));

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    queueStatus: null,
    analysisPaused: false,
    activeAnalysis: null,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastAccountStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/runtimeLogs/RuntimeLogsContext", () => ({
  useRuntimeLogs: () => ({
    logs: [],
    totalLogCount: 0,
    hasMoreLogs: false,
    logsLoading: false,
    logsLoadingMore: false,
    logLoadError: null,
    clearLogs: vi.fn(),
    refreshLogs: vi.fn(),
    loadMoreLogs: vi.fn(),
  }),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

import { MemoryRouter } from "react-router-dom";
import { SourceManagementPage } from "./SourceManagementPage";

/* ------------------------------------------------------------------ */
/*  Default mock setup                                                 */
/* ------------------------------------------------------------------ */

function setupDefaultMocks() {
  mockListTelegramAccounts.mockResolvedValue([]);
  mockListDiscordBots.mockResolvedValue([]);
  mockListRssFeeds.mockResolvedValue([]);
  mockListHttpSources.mockResolvedValue([]);
  mockListMqttBrokers.mockResolvedValue([]);
  mockListEmailMailboxes.mockResolvedValue([]);
  mockFetchAccessKeys.mockResolvedValue({ keys: [] });
  mockFetchSystemSettings.mockResolvedValue({});
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SourceManagementPage smoke test", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockListTelegramAccounts.mockReset();
    mockListDiscordBots.mockReset();
    mockListRssFeeds.mockReset();
    mockListHttpSources.mockReset();
    mockListMqttBrokers.mockReset();
    mockListEmailMailboxes.mockReset();
    mockFetchAccessKeys.mockReset();
    mockFetchSystemSettings.mockReset();
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

  it("renders the default Telegram tab without throwing", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Telegram");
    expect(container.textContent).toContain("Discord");
    expect(container.querySelector("h1")).toBeNull();
    expect(container.textContent).toContain("RSS");
    expect(container.textContent).toContain("MQTT");
    expect(container.textContent).toContain("Email");
    expect(container.textContent).toContain("HTTP");
    expect(container.textContent).not.toContain("Webhook");

    const topTabs = Array.from(
      container.querySelectorAll('[role="tablist"] [role="tab"]'),
    ).map((el) => (el.textContent || "").trim());
    expect(topTabs).not.toContain("API");
    expect(topTabs.some((label) => label.includes("Ingestion API"))).toBe(false);
  });

  it("opens Webhook sub-mode under HTTP tab", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts?tab=http&mode=webhook"] },
          createElement(SourceManagementPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("抓取");
    expect(container.textContent).toContain("Webhook");
    expect(container.textContent).toContain("Webhook 接入");
  });

  it("falls back to Telegram tab for unknown ?tab values", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts?tab=not-a-real-tab"] },
          createElement(SourceManagementPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const activeTab = container.querySelector('[role="tab"][aria-selected="true"]');
    expect(activeTab?.textContent).toContain("Telegram");
  });

  it("renders MQTT tab content without throwing", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const mqttTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "MQTT",
    );
    expect(mqttTab).toBeTruthy();

    await act(async () => {
      mqttTab!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("新增 MQTT Broker");
    expect(container.textContent).toContain("尚未新增任何 MQTT Broker");
  });

  it("renders Email tab content without throwing", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const emailTab = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent === "Email",
    );
    expect(emailTab).toBeTruthy();

    await act(async () => {
      emailTab!.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("新增 Email 信箱");
    expect(container.textContent).toContain("尚未新增任何 Email 信箱");
  });

  it("renders without exceptions when switching between tabs", async () => {
    const tabLabels = ["Telegram", "Discord", "RSS", "HTTP", "MQTT", "Email"];
    const tabSequence = [0, 2, 3, 1, 4, 5, 0];

    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    for (const tabIdx of tabSequence) {
      const tabButton = Array.from(
        container.querySelectorAll('[role="tablist"] [role="tab"]'),
      ).find((button) => button.textContent?.includes(tabLabels[tabIdx]));
      if (tabButton) {
        await act(async () => {
          tabButton.click();
          await Promise.resolve();
        });
      }
    }

    expect(container.textContent).toContain("Telegram");
  });
});

/* ------------------------------------------------------------------ */
/*  Visual Update Tests                                                */
/*  Validates: Requirements 12.2, 12.3, 12.4                          */
/* ------------------------------------------------------------------ */

describe("SourceManagementPage visual updates", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockListTelegramAccounts.mockReset();
    mockListDiscordBots.mockReset();
    mockListRssFeeds.mockReset();
    mockListHttpSources.mockReset();
    mockListMqttBrokers.mockReset();
    mockListEmailMailboxes.mockReset();
    mockFetchAccessKeys.mockReset();
    mockFetchSystemSettings.mockReset();
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

  function getTabButtons(): HTMLButtonElement[] {
    return Array.from(
      container.querySelectorAll('[role="tablist"] [role="tab"]'),
    ) as HTMLButtonElement[];
  }

  describe("tab active state (segmented pill nav)", () => {
    it("active tab has aria-selected=true", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const tabs = getTabButtons();
      const activeTab = tabs.find((tab) => tab.textContent?.includes("Telegram"));
      expect(activeTab).toBeTruthy();
      expect(activeTab!.getAttribute("aria-selected")).toBe("true");
    });

    it("clicking a different tab moves active state to the new tab", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const tabs = getTabButtons();
      const discordTab = tabs.find((tab) => tab.textContent?.includes("Discord"))!;
      const telegramTab = tabs.find((tab) => tab.textContent?.includes("Telegram"))!;

      await act(async () => {
        discordTab.click();
        await Promise.resolve();
      });

      expect(discordTab.getAttribute("aria-selected")).toBe("true");
      expect(telegramTab.getAttribute("aria-selected")).toBe("false");
    });
  });

  describe("account card layout", () => {
    it("account cards use sources-card-grid and sources-card classes", async () => {
      mockListTelegramAccounts.mockResolvedValue([
        {
          id: "acc-1",
          platform: "telegram",
          name: "Test Account",
          status: "connected",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);

      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const cardGrid = container.querySelector(".sources-card-grid");
      expect(cardGrid).toBeTruthy();

      const accountCard = cardGrid!.firstElementChild as HTMLElement;
      expect(accountCard.classList.contains("sources-card")).toBe(true);
      // Hover chrome lives on the inner AccentBarCard surface, not the wrapper.
      expect(accountCard.querySelector(".im-card-hover")).toBeTruthy();
    });

    it("account card keeps base styles without JS hover state", async () => {
      mockListTelegramAccounts.mockResolvedValue([
        {
          id: "acc-1",
          platform: "telegram",
          name: "Test Account",
          status: "connected",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ]);

      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const cardGrid = container.querySelector(".sources-card-grid");
      const accountCard = cardGrid!.firstElementChild as HTMLElement;

      expect(accountCard.style.transform).not.toBe("translateY(-2px)");
    });
  });

  describe("form input styling consistency (Req 12.4, 7.5)", () => {
    it("AddAccountForm inputs use polished form input styles", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      // The Telegram tab is active by default, which shows AddAccountForm
      const inputs = container.querySelectorAll(
        "input[type='text']",
      ) as NodeListOf<HTMLInputElement>;
      expect(inputs.length).toBeGreaterThanOrEqual(3); // apiId, apiHash, phone

      // Verify Tailwind form field classes are applied
      for (const input of inputs) {
        expect(input.className).toContain("h-8");
        expect(input.className).toContain("bg-surface-card");
        expect(input.className).toContain("border-surface-border");
        expect(input.className).toContain("rounded-md");
        expect(input.className).toContain("text-text-primary");
      }
    });

    it("form inputs apply focus styles on focus event", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const inputs = container.querySelectorAll(
        "input[type='text']",
      ) as NodeListOf<HTMLInputElement>;
      const firstInput = inputs[0];

      // Focus the input (React uses focusin which bubbles)
      await act(async () => {
        firstInput.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        await Promise.resolve();
      });

      // Tailwind focus styles are applied via class selectors, not inline styles
      expect(firstInput.className).toContain("focus:border-[color-mix(in_srgb,var(--accent)_55%");
      expect(firstInput.className).toContain("focus:shadow-");
    });

    it("form inputs reset focus styles on blur", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const inputs = container.querySelectorAll(
        "input[type='text']",
      ) as NodeListOf<HTMLInputElement>;
      const firstInput = inputs[0];

      // Focus then blur (React uses focusin/focusout which bubble)
      await act(async () => {
        firstInput.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        await Promise.resolve();
      });
      await act(async () => {
        firstInput.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
        await Promise.resolve();
      });

      // Tailwind focus styles remain on the class list; blur does not mutate inline styles
      expect(firstInput.className).toContain("focus:border-[color-mix(in_srgb,var(--accent)_55%");
      expect(firstInput.style.borderColor).toBe("");
    });

    it("form labels use polished form label styles", async () => {
      await act(async () => {
        root = createRoot(container);
        root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/accounts"] },
          createElement(SourceManagementPage),
        ),
      );
        await Promise.resolve();
        await Promise.resolve();
      });

      const labels = container.querySelectorAll(
        "label",
      ) as NodeListOf<HTMLLabelElement>;
      expect(labels.length).toBeGreaterThanOrEqual(3);

      for (const label of labels) {
        expect(label.className).toContain("text-caption");
        expect(label.className).toContain("font-medium");
        expect(label.className).toContain("text-text-primary");
      }
    });
  });
});
