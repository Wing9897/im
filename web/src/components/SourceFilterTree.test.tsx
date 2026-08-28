import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceFilterTree } from "./SourceFilterTree";
import { buildFilterTreeRows } from "../domain/tasks/sourceFilterSelection";
import { i18n, wrapWithI18n } from "../test/i18nHarness";
import { setAppLocale } from "../i18n/locale";

describe("SourceFilterTree workset cover", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    setAppLocale("en");
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders a compact cover thumb on workset rows", () => {
    const rows = buildFilterTreeRows(
      [{ id: "ws-1", name: "Ops", cover: "data:image/jpeg;base64,abc" }],
      [],
    );
    act(() => {
      root.render(
        wrapWithI18n(
          createElement(SourceFilterTree, {
            rows,
            query: "",
            onQueryChange: () => {},
            expanded: new Set(),
            onToggleExpanded: () => {},
            checkedTasks: new Set(),
            checkedWorksets: new Set(),
            allSourcesSelected: true,
            onToggleTask: () => {},
            onToggleWorkset: () => {},
          }),
        ),
      );
    });
    const cover = container.querySelector('[data-testid="source-filter-workset-cover-ws-1"]');
    expect(cover).toBeTruthy();
    expect(cover?.getAttribute("src")).toContain("data:image/jpeg;base64,abc");
  });
});
