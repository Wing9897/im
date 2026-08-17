import { act, createElement, Fragment } from "react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetTaskCatalogState, taskCatalogState } from "../../test/context-mocks";
import { createTestHarness, type TestHarness } from "../../test/render-helpers";
import { WorksetCatalogChrome } from "./WorksetCatalogChrome";

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock());

function GraphSearchProbe() {
  const [searchParams] = useSearchParams();
  return createElement("span", { "data-testid": "workset-graph-search" }, searchParams.toString());
}

function ChromeAt({ entry }: { entry: string }) {
  return createElement(
    MemoryRouter,
    { initialEntries: [entry] },
    createElement(Fragment, null, createElement(WorksetCatalogChrome), createElement(GraphSearchProbe)),
  );
}

describe("WorksetCatalogChrome", () => {
  let harness: TestHarness;

  beforeEach(() => {
    resetTaskCatalogState();
    taskCatalogState.worksets = [
      {
        id: "__user__",
        name: "一般",
        isSystem: true,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "ws-1",
        name: "Ops",
        isSystem: false,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "",
        updatedAt: "",
      },
    ];
  });

  afterEach(() => {
    harness?.cleanup();
  });

  it("defaults to the catalog pill", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets" });

    const tabs = [
      ...harness.container.querySelectorAll('[data-testid="workset-catalog-tabs"] [role="tab"]'),
    ];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["目錄", "流程圖"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(harness.container.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
  });

  it("switches to the pipeline graph tab", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets" });

    const tabs = [
      ...harness.container.querySelectorAll('[data-testid="workset-catalog-tabs"] [role="tab"]'),
    ];
    await act(async () => {
      (tabs[1] as HTMLButtonElement).click();
    });

    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("opens the graph tab from ?tab=graph", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets?tab=graph" });

    const tabs = [
      ...harness.container.querySelectorAll('[data-testid="workset-catalog-tabs"] [role="tab"]'),
    ];
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("puts a workset MenuSelect in the function bar on the graph tab", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets?tab=graph" });

    const filter = harness.container.querySelector('[data-testid="workset-graph-filter"]');
    const trigger = harness.container.querySelector(
      '[data-testid="workset-graph-filter-value"]',
    ) as HTMLButtonElement | null;
    expect(filter).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-filter-all"]')).toBeNull();
    expect(filter?.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
    expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
    expect(trigger?.textContent).toContain("全部");

    await act(async () => {
      trigger?.click();
    });
    const list = document.body.querySelector('[data-testid="workset-graph-filter-list"]');
    const general = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-__user__"]',
    ) as HTMLButtonElement | null;
    const all = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-all"]',
    ) as HTMLButtonElement | null;
    expect(list?.getAttribute("role")).toBe("listbox");
    expect(general?.textContent).toBe("一般");
    expect(all?.textContent).toBe("全部");
    expect(all?.getAttribute("aria-selected")).toBe("true");

    await act(async () => {
      general?.click();
    });
    expect(harness.container.querySelector('[data-testid="workset-graph-search"]')?.textContent).toContain(
      "worksetId=__user__",
    );
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("一般");

    await act(async () => {
      (
        harness.container.querySelector(
          '[data-testid="workset-graph-filter-value"]',
        ) as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      (
        document.body.querySelector(
          '[data-testid="workset-graph-filter-option-all"]',
        ) as HTMLButtonElement
      ).click();
    });
    expect(harness.container.querySelector('[data-testid="workset-graph-search"]')?.textContent).not.toContain(
      "worksetId=",
    );
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("全部");
  });

  it("keeps catalog selected on a contents page so pills can jump back", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets/ws-1" });

    const tabs = [
      ...harness.container.querySelectorAll('[data-testid="workset-catalog-tabs"] [role="tab"]'),
    ];
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("false");
    expect(harness.container.querySelector('[data-testid="workset-graph-filter"]')).toBeNull();
  });
});
