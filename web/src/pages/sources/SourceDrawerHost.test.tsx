/**
 * Create-source drawer must not take over the page's `tab` / `mode`,
 * and webhook must open the sources form without erasing the current page.
 */
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../components/sources/SourceDrawer", () => ({
  SourceDrawer: ({
    children,
    onClose,
  }: {
    children: ReactNode;
    onClose: () => void;
  }) =>
    createElement(
      "div",
      { "data-testid": "source-drawer" },
      createElement(
        "button",
        { type: "button", "data-testid": "drawer-close", onClick: onClose },
        "close",
      ),
      children,
    ),
}));

vi.mock("./SourceManagementPage", () => ({
  SourceManagementPage: () => createElement("div", { "data-testid": "source-drawer-form" }),
}));

import { SourceDrawerHost } from "./SourceDrawerHost";

function Harness() {
  const location = useLocation();
  const navigate = useNavigate();
  return createElement(
    "div",
    null,
    createElement("div", {
      "data-testid": "loc",
      "data-path": `${location.pathname}${location.search}${location.hash}`,
    }),
    createElement("button", {
      type: "button",
      "data-testid": "history-back",
      onClick: () => navigate(-1),
    }),
    createElement(SourceDrawerHost),
  );
}

function currentPath(container: HTMLElement): string {
  return container.querySelector("[data-testid='loc']")?.getAttribute("data-path") ?? "";
}

describe("SourceDrawerHost", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
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

  async function renderAt(path: string) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(MemoryRouter, { initialEntries: [path] }, createElement(Harness)),
      );
      await Promise.resolve();
    });
  }

  it("closes the drawer without removing the task graph tab", async () => {
    await renderAt("/tasks?tab=graph&source=new&sourceTab=discord");

    expect(container.querySelector("[data-testid='source-drawer']")).not.toBeNull();

    await act(async () => {
      (container.querySelector("[data-testid='drawer-close']") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(container.querySelector("[data-testid='source-drawer']")).toBeNull();
    expect(currentPath(container)).toBe("/tasks?tab=graph");
  });

  it("pushes the webhook form with returnTo instead of replacing the current page", async () => {
    await renderAt("/tasks?tab=graph&source=new&sourceTab=http&sourceMode=webhook");

    const path = currentPath(container);
    expect(path.startsWith("/sources?")).toBe(true);
    const params = new URLSearchParams(path.slice(path.indexOf("?") + 1));
    expect(params.get("tab")).toBe("http");
    expect(params.get("mode")).toBe("webhook");
    expect(params.get("returnTo")).toBe("/tasks?tab=graph");
    expect(params.get("source")).toBeNull();

    await act(async () => {
      (container.querySelector("[data-testid='history-back']") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(currentPath(container)).toBe("/tasks?tab=graph");
    expect(container.querySelector("[data-testid='source-drawer']")).toBeNull();
  });

  it("keeps the subscriptions sheet tab inside returnTo", async () => {
    await renderAt(
      "/timeline?sheet=subscriptions&tab=published&source=new&sourceTab=http&sourceMode=webhook",
    );

    const path = currentPath(container);
    const params = new URLSearchParams(path.slice(path.indexOf("?") + 1));
    expect(params.get("returnTo")).toBe("/timeline?sheet=subscriptions&tab=published");

    await act(async () => {
      (container.querySelector("[data-testid='history-back']") as HTMLButtonElement).click();
      await Promise.resolve();
    });

    expect(currentPath(container)).toBe("/timeline?sheet=subscriptions&tab=published");
  });

  it("drops source=new on the sources page and leaves the platform tab", async () => {
    await renderAt("/sources?tab=http&mode=webhook&source=new");

    expect(container.querySelector("[data-testid='source-drawer']")).toBeNull();
    expect(currentPath(container)).toBe("/sources?tab=http&mode=webhook");
  });
});
