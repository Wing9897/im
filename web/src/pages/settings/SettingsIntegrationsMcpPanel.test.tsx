import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";

vi.mock("../../api/baseUrl", () => ({
  resolveBaseUrl: () => "http://127.0.0.1:18820",
}));

const fetchMcpStatus = vi.fn();

vi.mock("../../api/mcp", () => ({
  fetchMcpStatus: (...args: unknown[]) => fetchMcpStatus(...args),
}));

const updateSettings = vi.fn();
const handleSave = vi.fn();

vi.mock("../../components/settings/useSettingsPageState", () => {
  return {
    useSettingsPageState: () => ({
      settings: {
        mcpEnabled: true,
        a2aEnabled: true,
        mcpCapCalendarRead: true,
        mcpCapCalendarWrite: true,
        mcpCapMessagesSearch: true,
        mcpCapIntelligenceSearch: true,
        mcpCapItemsRead: true,
        mcpCapItemsWrite: false,
      },
      settingsInitialLoading: false,
      updateSettings,
      handleSave,
      saving: false,
      saveSuccess: false,
    }),
  };
});

import { SettingsIntegrationsMcpPanel } from "./SettingsIntegrationsMcpPanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(root: Root) {
  act(() => {
    root.render(
      wrapWithI18n(createElement(MemoryRouter, null, createElement(SettingsIntegrationsMcpPanel))),
    );
  });
}

function expandSection(container: HTMLElement, title: string) {
  const toggle = Array.from(container.querySelectorAll("button")).find(
    (btn) =>
      btn.getAttribute("aria-expanded") === "false" &&
      btn.closest("div")?.textContent?.includes(title),
  );
  expect(toggle).toBeTruthy();
  act(() => {
    toggle!.click();
  });
}

describe("SettingsIntegrationsMcpPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps probe and capability toggles visible while collapsing OpenClaw and reference docs", () => {
    renderPage(root);

    const endpoint = container.querySelector('[data-testid="mcp-endpoint-url"]');
    expect(endpoint?.textContent).toBe("http://127.0.0.1:18820/api/v1/mcp");
    expect(container.querySelector('[data-testid="mcp-master-switch"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="a2a-master-switch"]')).toBeNull();
    expect(container.querySelector('[data-testid="mcp-probe-connection"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mcp-capability-toggles"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mcp-caps-shared-caption"]')?.textContent).toContain(
      "MCP 與 A2A 共用",
    );
    expect(container.querySelector('[data-testid="mcp-workset-hub"]')).toBeNull();
    expect(container.querySelector('[data-testid="workset-hub-link"]')).toBeNull();

    expect(container.textContent).toContain("OpenClaw 設定");
    expect(container.textContent).toContain("參考說明");
    expect(container.querySelector('[data-testid="mcp-docs-example"]')).toBeNull();
    expect(container.querySelector('[data-testid="mcp-link-keys"]')?.getAttribute("href")).toBe(
      "/account/keys",
    );
    expect(container.querySelector('[data-testid="mcp-link-a2a"]')).toBeNull();
    expect(container.textContent).not.toContain("Allowlist 總覽");
    expect(container.textContent).not.toContain("不會暴露");
    expect(container.textContent).toContain("外部 Agent 的工具連線");
    expect(container.textContent).not.toContain("不做自然語言 loop");
  });

  it("reveals OpenClaw example and reference lists after expanding collapsed sections", () => {
    renderPage(root);

    expandSection(container, "OpenClaw 設定");
    const example = container.querySelector('[data-testid="mcp-docs-example"]');
    expect(example?.textContent).toContain('"transport": "streamable-http"');
    expect(example?.textContent).toContain("Authorization");
    expect(example?.textContent).toContain("Bearer <access_key>");
    expect(example?.textContent).toContain("http://127.0.0.1:18820/api/v1/mcp");

    expandSection(container, "參考說明");
    expect(container.textContent).toContain("Allowlist 總覽");
    expect(container.textContent).toContain("不會暴露");
    expect(container.textContent).toContain("messages.search");
    expect(container.textContent).toContain("web.search");
    expect(container.querySelector('[data-testid="mcp-link-a2a"]')?.getAttribute("href")).toBe(
      "/settings/integrations?tab=a2a",
    );
  });

  it("shows capability switches with human copy and saves via settings draft flow", async () => {
    renderPage(root);

    const caps = container.querySelector('[data-testid="mcp-capability-toggles"]');
    expect(caps).not.toBeNull();
    expect(container.textContent).toContain("能力群組");
    expect(caps?.textContent).toContain("查看日程");
    expect(caps?.textContent).toContain("新增、更改、刪除日程");
    expect(caps?.textContent).toContain("搜尋訊息");
    expect(caps?.textContent).toContain("搜尋情報");
    expect(caps?.textContent).toContain("查看物品與即將到期");
    expect(caps?.textContent).toContain("新增、更改物品");
    expect(caps?.textContent).toContain("啟用 MCP");
    expect(caps?.textContent).not.toContain("items.create");
    expect(caps?.textContent).not.toContain("list_calendars");
    expect(caps?.textContent).not.toContain("/api/v1/mcp");

    const writeToggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="mcp-cap-mcpCapCalendarWrite"]',
    );
    const itemsWrite = container.querySelector<HTMLButtonElement>(
      '[data-testid="mcp-cap-mcpCapItemsWrite"]',
    );
    expect(writeToggle?.getAttribute("role")).toBe("switch");
    expect(writeToggle?.getAttribute("aria-checked")).toBe("true");
    expect(writeToggle?.getAttribute("aria-pressed")).toBeNull();
    expect(itemsWrite?.getAttribute("aria-checked")).toBe("false");
    expect(writeToggle?.disabled).toBe(false);

    await act(async () => {
      writeToggle?.click();
      await Promise.resolve();
    });
    expect(updateSettings).toHaveBeenCalledWith("mcpCapCalendarWrite", false);

    const master = container.querySelector<HTMLButtonElement>('[data-testid="mcp-master-switch"]');
    expect(master?.getAttribute("role")).toBe("switch");
    expect(master?.getAttribute("aria-checked")).toBe("true");
    expect(master?.className).not.toContain("im-surface-inset");
    await act(async () => {
      master?.click();
      await Promise.resolve();
    });
    expect(updateSettings).toHaveBeenCalledWith("mcpEnabled", false);

    const saveButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("儲存能力設定"),
    );
    expect(saveButton).toBeTruthy();
    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
    });
    expect(handleSave).toHaveBeenCalled();
  });

  it("keeps tool ids in the collapsed technical-names list", () => {
    renderPage(root);
    expect(container.querySelector('[data-testid="mcp-cap-tech-names"]')).toBeNull();
    expandSection(container, "技術名稱");
    const tech = container.querySelector('[data-testid="mcp-cap-tech-names"]');
    expect(tech?.textContent).toContain("items.create");
    expect(tech?.textContent).toContain("calendar.list_calendars");
    expect(tech?.textContent).toContain("messages.search");
  });

  it("probes MCP status without requiring an access key", async () => {
    fetchMcpStatus.mockResolvedValue({
      enabled: true,
      toolCount: 2,
      tools: [
        { name: "calendar.upcoming", description: "" },
        { name: "messages.search", description: "" },
      ],
    });

    renderPage(root);

    const button = container.querySelector<HTMLButtonElement>('[data-testid="mcp-probe-connection"]');
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
      await Promise.resolve();
    });
    // Flush the async probe + state update.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMcpStatus).toHaveBeenCalledTimes(1);
    const ok = container.querySelector('[data-testid="mcp-probe-ok"]');
    expect(ok?.textContent).toContain("2");
    expect(ok?.textContent).toContain("calendar.upcoming");
    expect(ok?.textContent).not.toContain("{toolCount}");
  });

  it("copies the OpenClaw config snippet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    renderPage(root);
    expandSection(container, "OpenClaw 設定");

    const button = container.querySelector<HTMLButtonElement>('[data-testid="mcp-copy-config"]');
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const pasted = writeText.mock.calls[0]?.[0] as string;
    expect(pasted).toContain('"transport": "streamable-http"');
    expect(pasted).toContain("http://127.0.0.1:18820/api/v1/mcp");
    expect(container.querySelector('[data-testid="mcp-copy-ok"]')).not.toBeNull();
  });
});
