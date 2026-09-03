/**
 * Full-mode `/worksets?tab=tasks` → `/tasks` (keep scheduling=open).
 * Hits only the Navigate branch — does not mount DashboardViewer.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorksetCatalogRoute } from "./AppRoutes";

function LocationProbe() {
  const loc = useLocation();
  return createElement("div", { "data-testid": "loc" }, `${loc.pathname}${loc.search}`);
}

describe("WorksetCatalogRoute bookmarks", () => {
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
        createElement(
          MemoryRouter,
          { initialEntries: [path] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/worksets",
              element: createElement(WorksetCatalogRoute),
            }),
            createElement(Route, {
              path: "/tasks",
              element: createElement(LocationProbe),
            }),
          ),
        ),
      );
      await Promise.resolve();
    });
  }

  it("redirects /worksets?tab=tasks to /tasks", async () => {
    await renderAt("/worksets?tab=tasks");
    expect(container.querySelector("[data-testid='loc']")?.textContent).toBe("/tasks");
  });

  it("keeps scheduling=open on the /tasks target", async () => {
    await renderAt("/worksets?tab=tasks&scheduling=open");
    expect(container.querySelector("[data-testid='loc']")?.textContent).toBe(
      "/tasks?scheduling=open",
    );
  });
});
