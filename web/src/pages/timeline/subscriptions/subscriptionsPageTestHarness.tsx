/**
 * Shared connected session, DOM mount, and i18n render flush for subscription page tests.
 * Mocks stay in each test file.
 */
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { wrapWithI18n } from "../../../test/i18nHarness";

export const connectedSession = {
  connected: true,
  baseUrl: "http://127.0.0.1:8787",
  handle: "Wing",
  status: "connected" as const,
};

export function mountSubscriptionsPage(): {
  mount: HTMLDivElement;
  root: Root;
} {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const root = createRoot(mount);
  return { mount, root };
}

/** Unmount then detach. Callers keep later cleanup (catalog reset, real timers) in afterEach. */
export function unmountSubscriptionsPage(
  root: Root,
  mount: HTMLElement,
): void {
  act(() => {
    root.unmount();
  });
  mount.remove();
}

/** `root.render(wrapWithI18n(node))` plus the three microtasks these page tests already flush. */
export async function renderWithI18n(
  root: Root,
  node: ReactNode,
): Promise<void> {
  await act(async () => {
    root.render(wrapWithI18n(node));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
