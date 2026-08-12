import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { AiStaffAvatar } from "./AiStaffAvatar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AiStaffAvatar", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("uses built-in src by default", () => {
    act(() => {
      root.render(wrapWithI18n(createElement(AiStaffAvatar, { staffId: "assistant", label: "助手" })));
    });
    const node = container.querySelector('[data-testid="ai-staff-avatar-assistant"]');
    expect(node).not.toBeNull();
    expect(node?.getAttribute("data-custom-src")).toBeNull();
    const img = node?.querySelector("img");
    expect(img?.getAttribute("src")).toBeTruthy();
  });

  it("honors src override and marks custom-src", () => {
    const custom = "data:image/jpeg;base64,abc";
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(AiStaffAvatar, {
            staffId: "assistant",
            label: "助手",
            src: custom,
          }),
        ),
      );
    });
    const node = container.querySelector('[data-testid="ai-staff-avatar-assistant"]');
    expect(node?.getAttribute("data-custom-src")).toBe("true");
    expect(node?.querySelector("img")?.getAttribute("src")).toBe(custom);
  });

  it("does not apply border, ring, or tinted frame background", () => {
    act(() => {
      root.render(wrapWithI18n(createElement(AiStaffAvatar, { staffId: "assistant", label: "助手" })));
    });
    const node = container.querySelector('[data-testid="ai-staff-avatar-assistant"]') as HTMLElement;
    expect(node.className).not.toMatch(/\bborder\b/);
    expect(node.className).not.toMatch(/\bring(?:-|\b)/);
    expect(node.className).not.toMatch(/\bshadow\b/);
    expect(node.className).toContain("bg-transparent");
    expect(node.className).toContain("overflow-hidden");
    expect(node.className).toContain("rounded-full");
  });

  it("renders page-local liaison avatar without roster kind/surface attrs", () => {
    act(() => {
      root.render(
        wrapWithI18n(createElement(AiStaffAvatar, { staffId: "liaison", label: "客戶經理" })),
      );
    });
    const node = container.querySelector('[data-testid="ai-staff-avatar-liaison"]');
    expect(node).not.toBeNull();
    expect(node?.getAttribute("data-staff-kind")).toBeNull();
    expect(node?.getAttribute("data-staff-surface")).toBeNull();
    expect(node?.querySelector("img")?.getAttribute("src")).toBeTruthy();
  });
});