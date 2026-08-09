import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AccountAccessKeysSection } from "./AccountAccessKeysSection";
import { _resetConnectionStoreForTests } from "../../domain/connection/connectionStore";
import { wrapWithI18n } from "../../test/i18nHarness";

const fetchAccessKeys = vi.fn();
const createAccessKey = vi.fn();
const revokeAccessKey = vi.fn();

vi.mock("../../api/accessKeys", () => ({
  fetchAccessKeys: (...args: unknown[]) => fetchAccessKeys(...args),
  createAccessKey: (...args: unknown[]) => createAccessKey(...args),
  revokeAccessKey: (...args: unknown[]) => revokeAccessKey(...args),
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock(),
);

describe("AccountAccessKeysSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    expect(createAccessKey).toHaveBeenCalledWith(expect.any(String), { readOnly: false });
    expect(container.querySelector('[data-testid="access-key-reveal"]')?.textContent).toContain(
      "full-secret-token",
    );
  });

  it("create with read-only checkbox passes readOnly", async () => {
    createAccessKey.mockResolvedValue({
      id: "k3",
      label: "Viewer",
      preview: "aaaa…bbbb",
      createdAt: "2026-03-01T00:00:00Z",
      scopes: ["read"],
      lastUsedAt: null,
      key: "read-secret",
    });
    renderSection();
    await act(async () => {
      await Promise.resolve();
    });
    const checkbox = container.querySelector(
      '[data-testid="access-key-read-only"]',
    ) as HTMLInputElement;
    await act(async () => {
      checkbox.click();
    });
    const createBtn = container.querySelector('[data-testid="access-key-create"]') as HTMLButtonElement;
    await act(async () => {
      createBtn.click();
    });
    expect(createAccessKey).toHaveBeenCalledWith(expect.any(String), { readOnly: true });
  });
});
