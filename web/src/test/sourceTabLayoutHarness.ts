import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ensureZhHantLocale, wrapWithI18n } from "./i18nHarness";

let container: HTMLDivElement;
let root: Root | null = null;

export function getTestContainer(): HTMLDivElement {
  return container;
}

export async function setupSourceTabTestHarness(): Promise<void> {
  await ensureZhHantLocale();
  container = document.createElement("div");
  document.body.appendChild(container);
}

export function teardownSourceTabTestHarness(): void {
  if (root) {
    act(() => root!.unmount());
  }
  root = null;
  container.remove();
}

export function renderSourceTab(component: () => ReactElement): void {
  act(() => {
    root = createRoot(container);
    root.render(wrapWithI18n(createElement(component)));
  });
}

export function renderInIsolatedContainer(component: () => ReactElement): {
  container: HTMLDivElement;
  unmount: () => void;
} {
  const localContainer = document.createElement("div");
  document.body.appendChild(localContainer);
  let localRoot: Root | null = null;

  act(() => {
    localRoot = createRoot(localContainer);
    localRoot.render(wrapWithI18n(createElement(component)));
  });

  return {
    container: localContainer,
    unmount: () => {
      act(() => localRoot!.unmount());
      localContainer.remove();
    },
  };
}
