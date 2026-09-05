import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { SettingsIntegrationsPage } from "./SettingsIntegrationsPage";
import { _resetConnectionStoreForTests } from "../../domain/connection/connectionStore.testing";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

vi.mock("../../api/baseUrl", () => ({
  resolveBaseUrl: () => "http://127.0.0.1:18820",
}));

const fetchMcpStatus = vi.fn();

vi.mock("../../api/mcp", () => ({
  fetchMcpStatus: (...args: unknown[]) => fetchMcpStatus(...args),
}));
vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock(),
);

const { settingsState, updateSettings, handleSave } = vi.hoisted(() => {
  const settingsState = {
    mcpEnabled: true,
    a2aEnabled: true,
    mcpCapCalendarRead: true,
    mcpCapCalendarWrite: true,
    mcpCapMessagesSearch: true,
    mcpCapIntelligenceSearch: true,
    mcpCapItemsRead: true,
    mcpCapItemsWrite: false,
  };
  const updateSettings = vi.fn(
    (key: keyof typeof settingsState, value: unknown) => {
      (settingsState as Record<string, unknown>)[key] = value;
    },
  );
  const handleSave = vi.fn();
  return { settingsState, updateSettings, handleSave };
});

vi.mock("../../components/settings/useSettingsPageState", () => ({
  useSettingsPageState: () => ({
    settings: settingsState,
    settingsInitialLoading: false,
    updateSettings,
    handleSave,
    saving: false,
    saveSuccess: false,
  }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("SettingsIntegrationsPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    localStorage.clear();
    _resetConnectionStoreForTests();
    settingsState.mcpEnabled = true;
    settingsState.a2aEnabled = true;
    settingsState.mcpCapCalendarRead = true;
    settingsState.mcpCapCalendarWrite = true;
    settingsState.mcpCapMessagesSearch = true;
    settingsState.mcpCapIntelligenceSearch = true;
    settingsState.mcpCapItemsRead = true;
    settingsState.mcpCapItemsWrite = false;
    updateSettings.mockClear();
    handleSave.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  function renderPage(initialEntry = "/settings/integrations") {
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(
            MemoryRouter,
            { initialEntries: [initialEntry] },
            createElement(SettingsIntegrationsPage),
          ),
        ),
      );
    });
  }

  function tabButton(label: string): HTMLButtonElement | undefined {
    return Array.from(container.querySelectorAll('button[role="tab"]')).find(
      (btn) => btn.textContent?.includes(label),
    ) as HTMLButtonElement | undefined;
  }

  it("defaults to Webhook with origin URL, key link, and collapsed examples", () => {
    renderPage();
    expect(
      container.querySelector('[data-testid="api-docs-base-url"]')?.textContent,
    ).toBe("http://127.0.0.1:18820");
    expect(
      container
        .querySelector('[data-testid="integrations-webhook-link-keys"]')
        ?.getAttribute("href"),
    ).toBe("/account/keys");
    expect(container.textContent).toContain("到帳戶產生金鑰");
    expect(container.textContent).toContain("需完整金鑰");
    expect(
      container.querySelector('[data-testid="api-docs-example"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("account_id");
    expect(
      container.querySelector('[data-testid="access-key-create"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("唯讀");
  });

  it("shows Webhook, A2A, Calendar link, and MCP as in-page pills", () => {
    renderPage();
    const pills = container.querySelector(
      '[data-testid="integrations-subtabs"]',
    );
    expect(pills).toBeTruthy();
    expect(pills?.querySelector("nav")?.className).toContain("w-auto");
    expect(pills?.querySelector("nav")?.className).not.toContain("mb-xl");
    expect(pills?.querySelector('[role="tablist"]')?.className).toContain(
      "inline-flex",
    );
    expect(tabButton("Webhook")).toBeTruthy();
    expect(tabButton("A2A")).toBeTruthy();
    expect(tabButton("日曆連結")).toBeTruthy();
    expect(tabButton("Desktop 日曆 deep link")).toBeFalsy();
    expect(tabButton("MCP")).toBeTruthy();
    expect(tabButton("系統 API 及網址")).toBeTruthy();
    expect(
      container.querySelector('[data-testid="navlink-/settings/api"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="navlink-/settings/mcp"]'),
    ).toBeNull();
    expect(container.querySelector('a[href="/settings/api"]')).toBeNull();
    expect(container.querySelector('a[href="/settings/mcp"]')).toBeNull();
  });

  it("opens the webhook example when the collapsed section is expanded", () => {
    renderPage();
    const webhookToggle = Array.from(container.querySelectorAll("button")).find(
      (btn) =>
        btn.getAttribute("aria-expanded") === "false" &&
        btn.closest("div")?.textContent?.includes("推送範例"),
    );
    expect(webhookToggle).toBeTruthy();
    act(() => {
      webhookToggle!.click();
    });
    expect(
      container.querySelector('[data-testid="api-docs-example"]'),
    ).not.toBeNull();
  });

  it("switches to A2A and MCP sub-pages", () => {
    renderPage();
    const a2a = tabButton("A2A");
    expect(a2a).toBeTruthy();
    act(() => {
      a2a!.click();
    });
    expect(
      container.querySelector('[data-testid="integrations-a2a-docs"]'),
    ).not.toBeNull();
    expect(
      container
        .querySelector('[data-testid="integrations-a2a-link-keys"]')
        ?.getAttribute("href"),
    ).toBe("/account/keys");
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-caps-shared-caption"]')
        ?.textContent,
    ).toContain("MCP 與 A2A 共用");
    expect(
      container.querySelector('[data-testid="a2a-master-switch"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-master-switch"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-workset-hub"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="workset-hub-link"]'),
    ).toBeNull();

    const mcp = tabButton("MCP");
    expect(mcp).toBeTruthy();
    act(() => {
      mcp!.click();
    });
    expect(
      container.querySelector('[data-testid="mcp-master-switch"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="a2a-master-switch"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-caps-shared-caption"]')
        ?.textContent,
    ).toContain("MCP 與 A2A 共用");
    expect(
      container
        .querySelector('[data-testid="mcp-link-keys"]')
        ?.getAttribute("href"),
    ).toBe("/account/keys");
    expect(
      container.querySelector('[data-testid="mcp-workset-hub"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="workset-hub-link"]'),
    ).toBeNull();
  });

  it("binds the same capability toggles on A2A and MCP and persists a toggle across tabs", () => {
    renderPage("/settings/integrations?tab=mcp");
    const writeOnMcp = container.querySelector<HTMLButtonElement>(
      '[data-testid="mcp-cap-mcpCapCalendarWrite"]',
    );
    expect(writeOnMcp?.getAttribute("aria-checked")).toBe("true");
    act(() => {
      writeOnMcp!.click();
    });
    expect(updateSettings).toHaveBeenCalledWith("mcpCapCalendarWrite", false);

    const a2a = tabButton("A2A");
    expect(a2a).toBeTruthy();
    act(() => {
      a2a!.click();
    });
    const writeOnA2a = container.querySelector<HTMLButtonElement>(
      '[data-testid="mcp-cap-mcpCapCalendarWrite"]',
    );
    expect(writeOnA2a?.getAttribute("aria-checked")).toBe("false");
    expect(
      container
        .querySelector('[data-testid="mcp-cap-mcpCapItemsWrite"]')
        ?.getAttribute("aria-checked"),
    ).toBe("false");
    expect(
      container.querySelector('[data-testid="mcp-master-switch"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="a2a-master-switch"]'),
    ).not.toBeNull();
    act(() => {
      writeOnA2a!.click();
    });
    expect(updateSettings).toHaveBeenCalledWith("mcpCapCalendarWrite", true);
  });

  it("does not show a worksets hub hint on MCP or A2A", async () => {
    renderPage("/settings/integrations?tab=mcp");
    expect(
      container.querySelector('[data-testid="workset-hub-link"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-workset-hub"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("到工作集設定");

    const a2a = tabButton("A2A");
    expect(a2a).toBeTruthy();
    await act(async () => {
      a2a!.click();
      await Promise.resolve();
    });
    expect(
      container.querySelector('[data-testid="workset-hub-link"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-workset-hub"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("到工作集設定");
  });

  it("does not show capability toggles on Webhook or Calendar link tabs", () => {
    renderPage();
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-workset-hub"]'),
    ).toBeNull();
    const deeplink = tabButton("日曆連結");
    expect(deeplink).toBeTruthy();
    act(() => {
      deeplink!.click();
    });
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-workset-hub"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="mcp-master-switch"]'),
    ).toBeNull();
  });

  it("opens MCP from ?tab=mcp", () => {
    renderPage("/settings/integrations?tab=mcp");
    expect(
      container.querySelector('[data-testid="mcp-endpoint-url"]')?.textContent,
    ).toBe("http://127.0.0.1:18820/api/v1/mcp");
    expect(
      container.querySelector('[data-testid="mcp-capability-toggles"]'),
    ).not.toBeNull();
  });

  it("opens deeplink from ?tab=deeplink", () => {
    renderPage("/settings/integrations?tab=deeplink");
    expect(
      container.querySelector('[data-testid="integrations-deeplink-url"]')
        ?.textContent,
    ).toContain("intelligencemonitor://");
    expect(
      container.querySelector('[data-testid="integrations-deeplink-docs"]')
        ?.textContent,
    ).toContain("日曆連結");
    expect(
      container.querySelector('[data-testid="integrations-deeplink-docs"]')
        ?.textContent,
    ).toContain("僅 Desktop");
    expect(container.textContent).not.toContain("Desktop 日曆 deep link");
    expect(
      container.querySelector('[data-testid="api-docs-example"]'),
    ).toBeNull();
  });

  it("opens system tab from ?tab=system with outbound URLs", () => {
    renderPage("/settings/integrations?tab=system");
    expect(
      container.querySelector('[data-testid="integrations-system-carto-card"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="integrations-system-outbound-list"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-testid="carto-api-key"]'),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-testid="integrations-system-outbound-url-open-meteo-forecast"]',
      )?.textContent,
    ).toBe("https://api.open-meteo.com/v1/forecast");
  });

  it("toggles A2A master enable on the A2A tab without touching MCP enable", async () => {
    renderPage("/settings/integrations?tab=a2a");
    const master = container.querySelector<HTMLButtonElement>(
      '[data-testid="a2a-master-switch"]',
    );
    expect(master?.getAttribute("role")).toBe("switch");
    expect(master?.getAttribute("aria-checked")).toBe("true");
    expect(container.textContent).toContain("啟用 A2A");
    expect(
      container.querySelector('[data-testid="mcp-master-switch"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-testid="a2a-caps-inactive-hint"]'),
    ).toBeNull();

    await act(async () => {
      master?.click();
      await Promise.resolve();
    });
    expect(updateSettings).toHaveBeenCalledWith("a2aEnabled", false);
    expect(updateSettings).not.toHaveBeenCalledWith(
      "mcpEnabled",
      expect.anything(),
    );
  });

  it("shows the A2A inactive hint when A2A is off and keeps MCP enable independent", () => {
    settingsState.a2aEnabled = false;
    renderPage("/settings/integrations?tab=a2a");
    expect(
      container.querySelector('[data-testid="a2a-caps-inactive-hint"]')
        ?.textContent,
    ).toContain("A2A 關閉");
    expect(
      container.querySelector('[data-testid="mcp-caps-inactive-hint"]'),
    ).toBeNull();
    expect(
      container
        .querySelector('[data-testid="a2a-master-switch"]')
        ?.getAttribute("aria-checked"),
    ).toBe("false");

    const mcp = tabButton("MCP");
    expect(mcp).toBeTruthy();
    act(() => {
      mcp!.click();
    });
    expect(
      container
        .querySelector('[data-testid="mcp-master-switch"]')
        ?.getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      container.querySelector('[data-testid="a2a-master-switch"]'),
    ).toBeNull();
  });
});
