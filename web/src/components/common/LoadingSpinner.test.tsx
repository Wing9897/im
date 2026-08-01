import { describe, it, expect, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { ensureZhHantLocale, wrapWithI18n } from "../../test/i18nHarness";
import { LoadingSpinner } from "./LoadingSpinner";

// Inlined copy of the module-private default spinner diameter used by
// `LoadingSpinner` as the fallback for the `size` prop.
const DEFAULT_SPINNER_SIZE = 24;

function renderSpinner(props?: { text?: string; size?: number }) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      wrapWithI18n(createElement(LoadingSpinner, props)),
    );
  });
  return container;
}

describe("LoadingSpinner", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("renders with default text", () => {
    const container = renderSpinner();
    expect(container.textContent).toContain("載入中…");
  });

  it("renders with custom text", () => {
    const container = renderSpinner({ text: "Loading data..." });
    expect(container.textContent).toContain("Loading data...");
  });

  it("does not render text when text is empty string", () => {
    const container = renderSpinner({ text: "" });
    // The span with text should not be rendered
    const spans = container.querySelectorAll("span");
    expect(spans.length).toBe(0);
  });

  it("has role='status' attribute", () => {
    const container = renderSpinner();
    const statusEl = container.querySelector("[role='status']");
    expect(statusEl).not.toBeNull();
  });

  it("has aria-live='polite' attribute", () => {
    const container = renderSpinner();
    const statusEl = container.querySelector("[aria-live='polite']");
    expect(statusEl).not.toBeNull();
  });

  it("renders spinner with default size", () => {
    const container = renderSpinner();
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    // The spinner div is the first child div inside the status container (after the style tag)
    const spinnerDiv = statusEl.querySelector("div") as HTMLElement;
    expect(spinnerDiv.style.width).toBe(`${DEFAULT_SPINNER_SIZE}px`);
    expect(spinnerDiv.style.height).toBe(`${DEFAULT_SPINNER_SIZE}px`);
  });

  it("renders spinner with custom size", () => {
    const container = renderSpinner({ size: 48 });
    const statusEl = container.querySelector("[role='status']") as HTMLElement;
    const spinnerDiv = statusEl.querySelector("div") as HTMLElement;
    expect(spinnerDiv.style.width).toBe("48px");
    expect(spinnerDiv.style.height).toBe("48px");
  });
});
