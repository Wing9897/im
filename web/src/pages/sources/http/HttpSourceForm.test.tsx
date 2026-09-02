import { act, createElement, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpSourceForm } from "./HttpSourceForm";
import { INITIAL_HTTP_FORM, type HttpFormFields } from "./httpFormTypes";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

function Harness({ onSubmit }: { onSubmit: () => void }) {
  const [fields, setFields] = useState<HttpFormFields>({
    ...INITIAL_HTTP_FORM,
    url: "https://example.com/status",
    name: "Status",
  });
  return createElement(HttpSourceForm, {
    fields,
    setFields,
    submitting: false,
    formError: null,
    onSubmit,
  });
}

describe("HttpSourceForm", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await ensureZhHantLocale();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("enables submit when URL is filled and calls onSubmit", () => {
    const onSubmit = vi.fn();
    act(() => {
      root.render(wrapWithI18n(createElement(Harness, { onSubmit })));
    });

    const action = Array.from(container.querySelectorAll("button")).at(-1) as HTMLButtonElement;
    expect(action.disabled).toBe(false);
    act(() => {
      action.click();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("keeps submit disabled when URL is empty", () => {
    function EmptyUrl() {
      const [fields, setFields] = useState<HttpFormFields>(INITIAL_HTTP_FORM);
      return createElement(HttpSourceForm, {
        fields,
        setFields,
        submitting: false,
        formError: null,
        onSubmit: () => {},
      });
    }
    act(() => {
      root.render(wrapWithI18n(createElement(EmptyUrl)));
    });
    const action = Array.from(container.querySelectorAll("button")).at(-1) as HTMLButtonElement;
    expect(action.disabled).toBe(true);
  });
});
