import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AccountAccessKeysSection } from "./AccountAccessKeysSection";
import { _resetConnectionStoreForTests } from "../../../domain/connection/connectionStore";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const fetchAccessKeys = vi.fn();
const createAccessKey = vi.fn();
const revokeAccessKey = vi.fn();

vi.mock("../../../api/accessKeys", () => ({
  fetchAccessKeys: (...args: unknown[]) => fetchAccessKeys(...args),
  createAccessKey: (...args: unknown[]) => createAccessKey(...args),
  revokeAccessKey: (...args: unknown[]) => revokeAccessKey(...args),
}));

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock(),
);

describe("AccountAccessKeysSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    localStorage.clear();
    _resetConnectionStoreForTests();
    fetchAccessKeys.mockReset();
    createAccessKey.mockReset();
    revokeAccessKey.mockReset();
    fetchAccessKeys.mockResolvedValue({
      keys: [
        {
          id: "k1",
          label: "Webhook",
          preview: "abcd…wxyz",
          createdAt: "2026-01-01T00:00:00Z",
          scopes: ["*"],
          lastUsedAt: null,
        },
      ],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  function renderSection() {
    act(() => {
      root.render(
        wrapWithI18n(createElement(AccountAccessKeysSection)),
      );
    });
  }

  it("loads keys and does not offer API-key login", async () => {
    renderSection();
    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchAccessKeys).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="profile-access-keys"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="access-key-row-k1"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="device-access-token-input"]')).toBeNull();
    expect(container.querySelector('[data-testid="advanced-api-key-input"]')).toBeNull();
    expect(container.querySelector('[data-testid="advanced-api-key-login"]')).toBeNull();
    expect(container.querySelector('[data-testid="advanced-api-key-toggle"]')).toBeNull();
  });

  it("keeps a short keys caption and does not offer read-only create", async () => {
    renderSection();
    await act(async () => {
      await Promise.resolve();
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Bearer 金鑰，用於 Webhook、A2A、MCP");
    expect(text).toContain("不能登入 UI");
    expect(text).not.toContain("僅限安全 GET/HEAD");
    expect(text).not.toContain("管理員帳號密碼");
    expect(container.querySelector('[data-testid="access-key-read-only"]')).toBeNull();
    expect(container.querySelector('[data-testid="access-key-advanced"]')).toBeNull();
    expect(text).not.toContain("進階");
  });

  it("shows the resolved API base URL for clients / MCP", async () => {
    renderSection();
    await act(async () => {
      await Promise.resolve();
    });
    const base = container.querySelector('[data-testid="account-keys-api-base-url"]');
    expect(base?.textContent).toMatch(/^https?:\/\//);
    const help = container.textContent ?? "";
    expect(help).toMatch(/MCP/i);
  });

  it("create key reveals secret once", async () => {
    createAccessKey.mockResolvedValue({
      id: "k2",
      label: "Webhook",
      preview: "secr…cret",
      createdAt: "2026-02-01T00:00:00Z",
      scopes: ["*"],
      lastUsedAt: null,
      key: "full-secret-token",
    });
    renderSection();
    await act(async () => {
      await Promise.resolve();
    });
    const createBtn = container.querySelector('[data-testid="access-key-create"]') as HTMLButtonElement;
    await act(async () => {
      createBtn.click();
    });
    expect(createAccessKey).toHaveBeenCalledWith(expect.any(String));
    expect(container.querySelector('[data-testid="access-key-reveal"]')?.textContent).toContain(
      "full-secret-token",
    );
  });

  it("still labels existing read keys in the list", async () => {
    fetchAccessKeys.mockResolvedValue({
      keys: [
        {
          id: "k-read",
          label: "Viewer",
          preview: "read…only",
          createdAt: "2026-03-01T00:00:00Z",
          scopes: ["read"],
          lastUsedAt: null,
        },
      ],
    });
    renderSection();
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="access-key-row-k-read"]')?.textContent).toContain(
      "唯讀",
    );
  });
});
