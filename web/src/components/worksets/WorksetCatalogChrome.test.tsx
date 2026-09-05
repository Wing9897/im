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
        id: "__general__",
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

  it("falls back leftover ?tab=tasks onto the catalog pill", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets?tab=tasks" });

    const tabs = [
      ...harness.container.querySelectorAll('[data-testid="workset-catalog-tabs"] [role="tab"]'),
    ];
    expect(tabs.map((tab) => tab.textContent)).toEqual(["目錄", "流程圖"]);
    expect(tabs[0]?.getAttribute("aria-selected")).toBe("true");
  });

  it("puts a workset checkbox menu in the function bar on the graph tab", async () => {
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets?tab=graph" });

    const filter = harness.container.querySelector('[data-testid="workset-graph-filter"]');
    const trigger = harness.container.querySelector(
      '[data-testid="workset-graph-filter-value"]',
    ) as HTMLButtonElement | null;
    expect(filter).toBeTruthy();
    expect(harness.container.querySelector('[data-testid="workset-graph-filter-all"]')).toBeNull();
    expect(filter?.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
    expect(trigger?.getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger?.textContent).toContain("2/2");

    await act(async () => {
      trigger?.click();
    });
    const list = document.body.querySelector('[data-testid="workset-graph-filter-list"]');
    const general = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-__general__"]',
    ) as HTMLInputElement | null;
    const ops = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-ws-1"]',
    ) as HTMLInputElement | null;
    expect(list?.getAttribute("role")).toBe("dialog");
    expect(general?.type).toBe("checkbox");
    expect(ops?.type).toBe("checkbox");
    expect(general?.checked).toBe(true);
    expect(ops?.checked).toBe(true);
    expect(document.body.querySelector('[data-testid="workset-graph-filter-option-all"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="workset-graph-filter-select-all"]')?.textContent).toBe(
      "全選",
    );
    expect(document.body.querySelector('[data-testid="workset-graph-filter-clear"]')?.textContent).toBe("清除");

    await act(async () => {
      ops?.click();
    });
    expect(harness.container.querySelector('[data-testid="workset-graph-search"]')?.textContent).toContain(
      "worksetId=__general__",
    );
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("1/2");

    await act(async () => {
      (
        document.body.querySelector(
          '[data-testid="workset-graph-filter-option-ws-1"]',
        ) as HTMLInputElement
      ).click();
    });
    expect(harness.container.querySelector('[data-testid="workset-graph-search"]')?.textContent).not.toContain(
      "worksetId=",
    );
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("2/2");
  });

  it("caps the graph checklist at 10 worksets and keeps 一般 optional", async () => {
    taskCatalogState.worksets = [
      {
        id: "__general__",
        name: "一般",
        isSystem: true,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "2020-01-01T00:00:00Z",
        updatedAt: "2020-01-01T00:00:00Z",
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `ws-${index + 1}`,
        name: `Set ${index + 1}`,
        isSystem: false,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
        updatedAt: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      })),
    ];
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets?tab=graph" });

    await act(async () => {
      (
        harness.container.querySelector(
          '[data-testid="workset-graph-filter-value"]',
        ) as HTMLButtonElement
      ).click();
    });

    const general = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-__general__"]',
    ) as HTMLInputElement | null;
    const oldest = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-ws-1"]',
    ) as HTMLInputElement | null;
    const newest = document.body.querySelector(
      '[data-testid="workset-graph-filter-option-ws-10"]',
    ) as HTMLInputElement | null;
    expect(general?.checked).toBe(true);
    expect(newest?.checked).toBe(true);
    expect(oldest?.checked).toBe(false);
    expect(oldest?.disabled).toBe(true);
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("10/11");
    expect(document.body.querySelector('[data-testid="workset-graph-filter-cap-hint"]')?.textContent).toContain(
      "最多同時顯示 10 個工作集",
    );

    await act(async () => {
      general?.click();
    });
    expect(
      (document.body.querySelector(
        '[data-testid="workset-graph-filter-option-__general__"]',
      ) as HTMLInputElement | null)?.checked,
    ).toBe(false);
    expect(
      (document.body.querySelector(
        '[data-testid="workset-graph-filter-option-ws-1"]',
      ) as HTMLInputElement | null)?.disabled,
    ).toBe(false);
  });

  it("lets 全選 check every workset past the cap and 清除 check none", async () => {
    taskCatalogState.worksets = [
      {
        id: "__general__",
        name: "一般",
        isSystem: true,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: "2020-01-01T00:00:00Z",
        updatedAt: "2020-01-01T00:00:00Z",
      },
      ...Array.from({ length: 10 }, (_, index) => ({
        id: `ws-${index + 1}`,
        name: `Set ${index + 1}`,
        isSystem: false,
        notifyEnabled: true,
        externalEnabled: true,
        createdAt: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
        updatedAt: `2024-01-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
      })),
    ];
    harness = createTestHarness();
    await harness.render(ChromeAt, { entry: "/worksets?tab=graph" });

    await act(async () => {
      (
        harness.container.querySelector(
          '[data-testid="workset-graph-filter-value"]',
        ) as HTMLButtonElement
      ).click();
    });

    await act(async () => {
      (document.body.querySelector('[data-testid="workset-graph-filter-select-all"]') as HTMLButtonElement).click();
    });
    expect(
      (document.body.querySelector(
        '[data-testid="workset-graph-filter-option-ws-1"]',
      ) as HTMLInputElement | null)?.checked,
    ).toBe(true);
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("11/11");
    expect(harness.container.querySelector('[data-testid="workset-graph-search"]')?.textContent).toContain(
      "worksetId=",
    );
    expect(document.body.querySelector('[data-testid="workset-graph-filter-cap-hint"]')).toBeNull();

    await act(async () => {
      (document.body.querySelector('[data-testid="workset-graph-filter-clear"]') as HTMLButtonElement).click();
    });
    expect(
      (document.body.querySelector(
        '[data-testid="workset-graph-filter-option-__general__"]',
      ) as HTMLInputElement | null)?.checked,
    ).toBe(false);
    expect(
      (document.body.querySelector(
        '[data-testid="workset-graph-filter-option-ws-10"]',
      ) as HTMLInputElement | null)?.checked,
    ).toBe(false);
    expect(harness.container.querySelector('[data-testid="workset-graph-search"]')?.textContent).toContain(
      "worksetId=__none__",
    );
    expect(
      harness.container.querySelector('[data-testid="workset-graph-filter-value"]')?.textContent,
    ).toContain("0/11");
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
