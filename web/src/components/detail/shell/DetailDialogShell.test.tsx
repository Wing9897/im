import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DetailDialogShell } from "./DetailDialogShell";
import { DetailMetricsRow } from "../atoms/DetailMetricsRow";
import { wrapWithI18n } from "../../../test/i18nHarness";

vi.mock("../../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("../../common/OverlayPortal", () => ({
  OverlayPortal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="overlay">{children}</div>
  ),
}));

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
  }
  root = null;
  container.remove();
});

describe("DetailDialogShell", () => {
  it("renders children and calls onClose from close button", () => {
    const onClose = vi.fn();
    act(() => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(
            DetailDialogShell,
            { onClose },
            createElement("div", null, "Dialog body"),
          )),
      );
    });

    expect(container.textContent).toContain("Dialog body");
    expect(container.querySelector(".im-material-panel")).toBeTruthy();
    expect(container.querySelector(".im-animate-in-scale")).toBeTruthy();
    const closeButton = container.querySelector("[aria-label='關閉']");
    expect(closeButton).toBeTruthy();

    act(() => {
      (closeButton as HTMLButtonElement).click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("DetailMetricsRow", () => {
  it("renders metric labels and values", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(DetailMetricsRow, {
          metrics: [
            { label: "待分析", value: "12" },
            { label: "已分析", value: "34" },
          ],
        }),
      );
    });

    expect(container.querySelector("[data-testid='detail-metrics-tile']")).toBeTruthy();
    expect(container.textContent).toContain("待分析");
    expect(container.textContent).toContain("12");
  });
});
