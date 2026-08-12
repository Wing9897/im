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

vi.mock("./SettingsShared", async () => {
  const actual = await vi.importActual<typeof import("./SettingsShared")>("./SettingsShared");
  return {
    ...actual,
    useSettingsPageState: () => ({
      settings: {
        mcpEnabled: true,
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

import { SettingsMcpPage } from "./SettingsMcpPage";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function renderPage(root: Root) {
  act(() => {
    root.render(
      wrapWithI18n(createElement(MemoryRouter, null, createElement(SettingsMcpPage))),
    );
  });
}

describe("SettingsMcpPage", () => {
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

  it("renders endpoint, OpenClaw example, capability lists, and key links", () => {
    renderPage(root);

    const endpoint = container.querySelector('[data-testid="mcp-endpoint-url"]');
    expect(endpoint?.textContent).toBe("http://127.0.0.1:18820/api/v1/mcp");

    const example = container.querySelector('[data-testid="mcp-docs-example"]');
    expect(example?.textContent).toContain('"transport": "streamable-http"');
    expect(example?.textContent).toContain("Authorization");
    expect(example?.textContent).toContain("Bearer <access_key>");
    expect(example?.textContent).toContain("http://127.0.0.1:18820/api/v1/mcp");

    expect(container.textContent).toContain("Allowlist 總覽");
    expect(container.textContent).toContain("不會暴露");
    expect(container.textContent).toContain("messages.search");
    expect(container.textContent).toContain("web.search");

    expect(container.querySelector('[data-testid="mcp-link-keys"]')?.getAttribute("href")).toBe(
      "/account/keys",
    );
    expect(container.querySelector('[data-testid="mcp-link-api"]')?.getAttribute("href")).toBe(
      "/settings/api",
    );
    expect(container.querySelector('[data-testid="mcp-master-switch"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="mcp-probe-connection"]')).not.toBeNull();
  });

  it("shows capability checkboxes and saves via settings draft flow", async () => {
    renderPage(root);

    expect(container.querySelector('[data-testid="mcp-capability-toggles"]')).not.toBeNull();
    expect(container.textContent).toContain("能力群組");

    const writeToggle = container.querySelector<HTMLInputElement>(
      '[data-testid="mcp-cap-mcpCapCalendarWrite"]',
    );
    const itemsWrite = container.querySelector<HTMLInputElement>(
      '[data-testid="mcp-cap-mcpCapItemsWrite"]',
    );
    expect(writeToggle?.checked).toBe(true);
    expect(itemsWrite?.checked).toBe(false);
    expect(writeToggle?.disabled).toBe(false);

    await act(async () => {
      writeToggle?.click();
      await Promise.resolve();
    });
    expect(updateSettings).toHaveBeenCalledWith("mcpCapCalendarWrite", false);

    const master = container.querySelector<HTMLInputElement>('[data-testid="mcp-master-switch"]');
    await act(async () => {
      master?.click();
      await Promise.resolve();
    });
    expect(updateSettings).toHaveBeenCalledWith("mcpEnabled", false);

    const saveButton = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("儲存 MCP 設定"),
    );
    expect(saveButton).toBeTruthy();
    await act(async () => {
      saveButton?.click();
      await Promise.resolve();
    });
    expect(handleSave).toHaveBeenCalled();
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
