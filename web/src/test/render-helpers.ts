import { act, createElement, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { wrapWithI18n } from "./i18nHarness";

export interface TestHarness {
  container: HTMLDivElement;
  render: <P extends object>(
    Component: ComponentType<P>,
    props?: Partial<P>,
  ) => Promise<void>;
  renderSync: <P extends object>(
    Component: ComponentType<P>,
    props?: Partial<P>,
  ) => void;
  cleanup: () => void;
}

function wrapComponent<P extends object>(
  Component: ComponentType<P>,
  props?: Partial<P>,
) {
  return wrapWithI18n(createElement(Component, (props ?? {}) as P));
}

export function createTestHarness(): TestHarness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root | null = null;

  return {
    container,
    async render<P extends object>(Component: ComponentType<P>, props?: Partial<P>) {
      await act(async () => {
        if (!root) {
          root = createRoot(container);
        }
        root.render(wrapComponent(Component, props));
        await Promise.resolve();
      });
    },
    renderSync<P extends object>(Component: ComponentType<P>, props?: Partial<P>) {
      act(() => {
        if (!root) {
          root = createRoot(container);
        }
        root.render(wrapComponent(Component, props));
      });
    },
    cleanup() {
      if (root) {
        act(() => {
          root!.unmount();
        });
        root = null;
      }
      container.remove();
    },
  };
}
