/**
 * Redirect behaviour of the simple-mode route gate.
 *
 * The gate wraps the whole route tree in `AppRoutes`, so a wrong branch either
 * leaks collect/analyze surfaces into simple mode or bounces full-mode users
 * off every page. Simple mode is driven through a mocked `useSimpleMode` so
 * each case can flip the flag without touching persisted state.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SimpleModeGate } from "./SimpleModeGate";
import { SIMPLE_MODE_HOME } from "../domain/ui/simpleMode";

const simpleModeState = vi.hoisted(() => ({ simpleMode: false }));

vi.mock("../context/SimpleModeContext", () => ({
  useSimpleMode: () => ({
    simpleMode: simpleModeState.simpleMode,
    setSimpleMode: vi.fn(),
  }),
}));

function NavigationTypeProbe() {
  return createElement(
    "div",
    { "data-testid": "home", "data-navigation-type": useNavigationType() },
    "home",
  );
}

describe("SimpleModeGate", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    simpleModeState.simpleMode = false;
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

  /** Mount the gate at `path`, with the simple-mode home as a redirect target. */
  async function renderAt(path: string) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            SimpleModeGate,
            null,
            createElement(
              Routes,
              null,
              createElement(Route, {
                path: SIMPLE_MODE_HOME,
                element: createElement(NavigationTypeProbe),
              }),
              createElement(Route, {
                path: "*",
                element: createElement("div", { "data-testid": "gated" }, "gated"),
              }),
            ),
          ),
        ),
      );
      await Promise.resolve();
    });
  }

  const gated = () => container.querySelector('[data-testid="gated"]');
  const home = () => container.querySelector('[data-testid="home"]');

  describe("full mode", () => {
    it("renders collect/analyze routes untouched", async () => {
      await renderAt("/monitor");

      expect(gated()).toBeTruthy();
      expect(home()).toBeNull();
    });

    it("renders the analysis-strategy AI tab untouched", async () => {
      await renderAt("/ai/analysis-strategy");

      expect(gated()).toBeTruthy();
    });
  });

  describe("simple mode", () => {
    beforeEach(() => {
      simpleModeState.simpleMode = true;
    });

    it("redirects a hidden path to the simple-mode home", async () => {
      await renderAt("/monitor");

      expect(home()).toBeTruthy();
      expect(gated()).toBeNull();
    });

    it("redirects the Tasks page", async () => {
      await renderAt("/tasks");

      expect(home()).toBeTruthy();
      expect(gated()).toBeNull();
    });

    it("redirects task-only subroutes", async () => {
      await renderAt("/tasks/abc/edit");

      expect(home()).toBeTruthy();
      expect(gated()).toBeNull();
    });

    it("keeps schedule reachable", async () => {
      await renderAt("/schedule");

      expect(gated()).toBeTruthy();
      expect(home()).toBeNull();
    });

    it("keeps items reachable", async () => {
      await renderAt("/items");

      expect(gated()).toBeTruthy();
      expect(home()).toBeNull();
    });

    it("redirects deep links under a hidden prefix", async () => {
      // Prefix matching, not equality — /sources/tg-1 is just as hidden.
      await renderAt("/sources/tg-1");

      expect(home()).toBeTruthy();
      expect(gated()).toBeNull();
    });

    it("redirects the hidden analysis-strategy AI tab", async () => {
      await renderAt("/ai/analysis-strategy");

      expect(home()).toBeTruthy();
      expect(gated()).toBeNull();
    });

    it("keeps sibling AI tabs reachable", async () => {
      // The AI-tab rule must not degrade into a bare "/ai" prefix match, or
      // simple mode would lose the whole AI workspace.
      await renderAt("/ai/provider");

      expect(gated()).toBeTruthy();
      expect(home()).toBeNull();
    });

    it("renders the simple-mode home itself without redirecting", async () => {
      // Guards against a redirect loop on the destination route.
      await renderAt(SIMPLE_MODE_HOME);

      expect(home()?.getAttribute("data-navigation-type")).toBe("POP");
    });

    it("replaces history so Back does not bounce off the hidden route", async () => {
      await renderAt("/monitor");

      expect(home()?.getAttribute("data-navigation-type")).toBe("REPLACE");
    });
  });
});
