/**
 * Boundary condition tests for AddTelegramSourceForm.
 *
 * Boundary tests for form components with validation: empty input, max
 * length, special characters, Unicode.
 *
 * AddTelegramSourceForm is the inline form rendered inside the Sources page that
 * captures Telegram API credentials. The submit button is disabled when
 * required fields are empty — these tests pin that boundary,
 * verify special characters and Unicode survive the controlled-input
 * round-trip, and assert that excessively long inputs still allow submit.
 */
import { describe, it, expect, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach } from "vitest";

import { AddTelegramSourceForm, type TelegramLoginMethod } from "./AddTelegramSourceForm";

interface FormBindings {
  loginMethod: TelegramLoginMethod;
  apiId: string;
  apiHash: string;
  phone: string;
}

function renderForm(
  container: HTMLElement,
  initial: Partial<FormBindings> = {},
  onSubmit: () => Promise<void> = async () => {},
) {
  const state: FormBindings = {
    loginMethod: initial.loginMethod ?? "phone",
    apiId: initial.apiId ?? "",
    apiHash: initial.apiHash ?? "",
    phone: initial.phone ?? "",
  };

  const setLoginMethod = vi.fn((value: TelegramLoginMethod) => {
    state.loginMethod = value;
  });
  const setApiId = vi.fn((value: string) => {
    state.apiId = value;
  });
  const setApiHash = vi.fn((value: string) => {
    state.apiHash = value;
  });
  const setPhone = vi.fn((value: string) => {
    state.phone = value;
  });

  let root: Root | null = null;
  act(() => {
    root = createRoot(container);
    root.render(
      createElement(AddTelegramSourceForm, {
        loginMethod: state.loginMethod,
        setLoginMethod,
        apiId: state.apiId,
        setApiId,
        apiHash: state.apiHash,
        setApiHash,
        phone: state.phone,
        setPhone,
        submitting: false,
        onSubmit,
      }),
    );
  });

  return { state, setLoginMethod, setApiId, setApiHash, setPhone, root: root! };
}

function getSubmitButton(container: HTMLElement): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll("button")).filter(
    (button) => button.getAttribute("role") !== "tab",
  );
  return buttons[buttons.length - 1] as HTMLButtonElement;
}

function getInputs(container: HTMLElement) {
  const inputs = container.querySelectorAll(
    "input[type='text']",
  ) as NodeListOf<HTMLInputElement>;
  return {
    apiId: inputs[0]!,
    apiHash: inputs[1]!,
    phone: inputs[2]!,
  };
}

function fireInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("AddTelegramSourceForm — boundary conditions", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  // ── Empty input ────────────────────────────────────────

  it("disables submit button when all fields are empty", () => {
    renderForm(container);
    expect(getSubmitButton(container).disabled).toBe(true);
  });

  it("disables submit button when only apiId is filled", () => {
    renderForm(container, { apiId: "12345678" });
    expect(getSubmitButton(container).disabled).toBe(true);
  });

  it("disables submit button when only apiHash is filled", () => {
    renderForm(container, { apiHash: "abc123def" });
    expect(getSubmitButton(container).disabled).toBe(true);
  });

  it("enables submit button only when all three fields are non-empty", () => {
    renderForm(container, {
      apiId: "12345678",
      apiHash: "abc123def",
      phone: "+886912345678",
    });
    expect(getSubmitButton(container).disabled).toBe(false);
  });

  it("calls onSubmit when required fields are filled", async () => {
    const onSubmit = vi.fn(async () => {});
    renderForm(
      container,
      {
        apiId: "12345678",
        apiHash: "abc123def",
        phone: "+886912345678",
      },
      onSubmit,
    );
    await act(async () => {
      getSubmitButton(container).click();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("enables QR submit when apiId and apiHash are filled without phone", () => {
    renderForm(container, {
      loginMethod: "qr",
      apiId: "12345678",
      apiHash: "abc123def",
    });
    expect(getSubmitButton(container).disabled).toBe(false);
    expect(container.querySelector("#telegram-phone")).toBeNull();
  });

  // ── Max length input ───────────────────────────────────

  it("does not truncate excessively long input values in the controlled input", () => {
    const { setApiHash } = renderForm(container);
    const inputs = getInputs(container);

    const longHash = "a".repeat(5000);
    fireInput(inputs.apiHash, longHash);

    expect(setApiHash).toHaveBeenCalledWith(longHash);
  });

  // ── Special characters ─────────────────────────────────

  it("propagates SQL-special characters in apiId without filtering", () => {
    // The form is a passthrough; validation/parameterization happens at the
    // backend. This test guards against accidental client-side stripping
    // that would mask backend bugs.
    const { setApiId } = renderForm(container);
    const inputs = getInputs(container);

    const sqlInjection = "'; DROP TABLE sources; --";
    fireInput(inputs.apiId, sqlInjection);

    expect(setApiId).toHaveBeenCalledWith(sqlInjection);
  });

  it("propagates HTML/script content in apiHash without escaping", () => {
    const { setApiHash } = renderForm(container);
    const inputs = getInputs(container);

    const htmlPayload = "<script>alert('xss')</script>";
    fireInput(inputs.apiHash, htmlPayload);

    expect(setApiHash).toHaveBeenCalledWith(htmlPayload);
  });

  // ── Unicode ────────────────────────────────────────────

  it("propagates emoji in the phone field", () => {
    const { setPhone } = renderForm(container);
    const inputs = getInputs(container);

    fireInput(inputs.phone, "+886-📞-912345678");

    expect(setPhone).toHaveBeenCalledWith("+886-📞-912345678");
  });

  it("propagates CJK text in apiId field", () => {
    const { setApiId } = renderForm(container);
    const inputs = getInputs(container);

    fireInput(inputs.apiId, "12345678 — 主帳號");

    expect(setApiId).toHaveBeenCalledWith("12345678 — 主帳號");
  });

  it("propagates RTL Arabic text in apiHash field", () => {
    const { setApiHash } = renderForm(container);
    const inputs = getInputs(container);

    fireInput(inputs.apiHash, "abc-مفتاح-API");

    expect(setApiHash).toHaveBeenCalledWith("abc-مفتاح-API");
  });
});
