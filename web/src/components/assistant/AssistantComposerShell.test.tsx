import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import type { AssistantComposerShellProps } from "./AssistantComposerShell";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

import { AssistantComposerShell } from "./AssistantComposerShell";

function defaultProps(
  overrides?: Partial<AssistantComposerShellProps>,
): AssistantComposerShellProps {
  return {
    variant: "page",
    draft: "hello",
    onDraftChange: vi.fn(),
    sending: false,
    listening: false,
    worksetId: "__general__",
    onWorksetIdChange: vi.fn(),
    onSend: vi.fn(),
    sttAvailable: true,
    spacePttMode: "hold",
    startListening: vi.fn(),
    stopListening: vi.fn(),
    ...overrides,
  };
}

describe("AssistantComposerShell", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    await ensureZhHantLocale();
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

  function render(props: AssistantComposerShellProps): void {
    act(() => {
      root = createRoot(container);
      root.render(wrapWithI18n(createElement(AssistantComposerShell, props) as ReactElement));
    });
  }

  it("does not send on Enter when sendDisabled", () => {
    const onSend = vi.fn();
    render(defaultProps({ onSend, sendDisabled: true }));

    const send = container.querySelector<HTMLButtonElement>("[data-testid='assistant-send']");
    expect(send?.disabled).toBe(true);
    expect(send?.getAttribute("title")).toContain("AI 設定");
    expect(send?.getAttribute("aria-label")).toContain("AI 設定");

    const draft = container.querySelector<HTMLTextAreaElement>("[data-testid='assistant-draft']");
    act(() => {
      draft!.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
      );
    });
    expect(onSend).not.toHaveBeenCalled();

    const ptt = container.querySelector<HTMLButtonElement>("[data-testid='assistant-ptt']");
    expect(ptt?.disabled).toBe(true);
  });

  it("sends on Enter when the composer is enabled", () => {
    const onSend = vi.fn();
    render(defaultProps({ onSend }));

    const send = container.querySelector<HTMLButtonElement>("[data-testid='assistant-send']");
    expect(send?.disabled).toBe(false);
    expect(send?.getAttribute("title")).toBeNull();

    const draft = container.querySelector<HTMLTextAreaElement>("[data-testid='assistant-draft']");
    act(() => {
      draft!.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
      );
    });
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
