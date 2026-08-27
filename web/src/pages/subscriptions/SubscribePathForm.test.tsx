import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SubscribePathForm } from "./SubscribePathForm";
import { i18n, wrapWithI18n } from "../../test/i18nHarness";
import { setAppLocale } from "../../i18n/locale";

function fireInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("SubscribePathForm", () => {
  let mount: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    mount = document.createElement("div");
    document.body.appendChild(mount);
    root = createRoot(mount);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    mount.remove();
  });

  function renderForm(props: { ownHandle?: string; onSubmit?: (handle: string, slug: string) => void } = {}) {
    const onSubmit = props.onSubmit ?? vi.fn();
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(SubscribePathForm, {
            ownHandle: props.ownHandle ?? "Wing",
            onSubmit,
          }),
        ),
      );
    });
    return { onSubmit };
  }

  function pathInput() {
    return document.querySelector('[data-testid="subscribe-path"]') as HTMLInputElement;
  }

  function submitButton() {
    return document.querySelector('[data-testid="subscribe-path-submit"]') as HTMLButtonElement;
  }

  it("rejects the signed-in handle and does not submit", () => {
    const { onSubmit } = renderForm({ ownHandle: "Wing" });
    fireInput(pathInput(), "Wing/Work");
    expect(submitButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("You cannot subscribe to your own calendar.");
    act(() => {
      submitButton().click();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("rejects own handle case-insensitively", () => {
    const { onSubmit } = renderForm({ ownHandle: "Wing" });
    fireInput(pathInput(), "wing/Personal");
    expect(submitButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("You cannot subscribe to your own calendar.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a valid other handle/slug", () => {
    const { onSubmit } = renderForm({ ownHandle: "Wing" });
    fireInput(pathInput(), "Alice/Work");
    expect(submitButton().disabled).toBe(false);
    act(() => {
      submitButton().click();
    });
    expect(onSubmit).toHaveBeenCalledWith("Alice", "Work");
  });

  it("blocks invalid path", () => {
    const { onSubmit } = renderForm();
    fireInput(pathInput(), "Alice");
    expect(submitButton().disabled).toBe(true);
    expect(document.body.textContent).toContain("Use handle/slug.");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
