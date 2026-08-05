import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";
import { SecretsBrokenGate } from "./SecretsBrokenGate";

const rotateSecretsPublic = vi.fn();

vi.mock("../api/system", async () => {
  const actual = await vi.importActual<typeof import("../api/system")>("../api/system");
  return {
    ...actual,
    rotateSecretsPublic: (...args: unknown[]) => rotateSecretsPublic(...args),
  };
});

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("SecretsBrokenGate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    rotateSecretsPublic.mockReset();
    rotateSecretsPublic.mockResolvedValue({
      message: "Secrets rotated",
      secretsReady: true,
      scrubbed: { system_config: 1, sources: 0, actions: 0 },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("submits admin credentials and calls onRecoverComplete on success", async () => {
    const onRecoverComplete = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(SecretsBrokenGate, { onRecoverComplete }),
        ),
      );
      await Promise.resolve();
    });

    const username = container.querySelector(
      '[data-testid="secrets-rotate-username"]',
    ) as HTMLInputElement;
    const password = container.querySelector(
      '[data-testid="secrets-rotate-password"]',
    ) as HTMLInputElement;
    const submit = container.querySelector(
      '[data-testid="secrets-rotate-submit"]',
    ) as HTMLButtonElement;

    expect(username).toBeTruthy();
    expect(password).toBeTruthy();
    expect(submit.disabled).toBe(true);

    await act(async () => {
      setInputValue(username, "Admin");
      setInputValue(password, "secret-pass");
      await Promise.resolve();
    });

    expect(submit.disabled).toBe(false);

    await act(async () => {
      submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(rotateSecretsPublic).toHaveBeenCalledWith({
      username: "admin",
      password: "secret-pass",
    });
    expect(onRecoverComplete).toHaveBeenCalledTimes(1);
  });

  it("keeps the gate open and shows error when rotate fails", async () => {
    rotateSecretsPublic.mockRejectedValue(new Error("Invalid username or password"));
    const onRecoverComplete = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(SecretsBrokenGate, { onRecoverComplete }),
        ),
      );
      await Promise.resolve();
    });

    const username = container.querySelector(
      '[data-testid="secrets-rotate-username"]',
    ) as HTMLInputElement;
    const password = container.querySelector(
      '[data-testid="secrets-rotate-password"]',
    ) as HTMLInputElement;
    const submit = container.querySelector(
      '[data-testid="secrets-rotate-submit"]',
    ) as HTMLButtonElement;

    await act(async () => {
      setInputValue(username, "admin");
      setInputValue(password, "wrong");
      submit.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onRecoverComplete).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/Invalid username or password/);
  });
});
