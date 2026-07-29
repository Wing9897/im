import { describe, expect, it, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import i18n from "../../../i18n";
import { DetailPresentationShell } from "./DetailPresentationShell";

vi.mock("../../common/OverlayPortal", () => ({
  OverlayPortal: ({
    children,
    ...rest
  }: {
    children: unknown;
    "aria-label"?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "overlay", "aria-label": rest["aria-label"] },
      children as never,
    ),
}));

describe("DetailPresentationShell", () => {
  it("renders inline preview for presentation=inline", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          DetailPresentationShell,
          {
            presentation: "inline",
            onClose: () => {},
            "aria-label": "詳情：測試",
            className: "shell-class",
          },
          createElement("span", null, "body"),
        ),
      );
    });

    expect(container.querySelector('[role="complementary"]')).not.toBeNull();
    expect(container.textContent).toContain("body");
    expect(container.querySelector(".shell-class")).not.toBeNull();
  });

  it("renders dialog overlay for presentation=modal", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(
            DetailPresentationShell,
            {
              presentation: "modal",
              onClose: () => {},
              "aria-label": "詳情：測試",
            },
            createElement("span", null, "body"),
          ),
        ),
      );
    });

    expect(container.querySelector('[data-testid="overlay"]')).not.toBeNull();
    expect(container.textContent).toContain("body");
  });
});
