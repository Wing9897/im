import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Workset } from "../../../api/worksets";
import type { TaskCatalogContextValue } from "../../../context/TaskCatalogContext";

const optionalCatalog = vi.hoisted(() => ({
  current: null as TaskCatalogContextValue | null,
}));

const stableT = vi.hoisted(() => (key: string) => key);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: stableT }),
}));

vi.mock("../../../api/items", () => ({
  listItemCategories: vi.fn(),
  getItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock("../../../api/worksets", () => ({
  listWorksets: vi.fn(),
}));

vi.mock("../../../context/TaskCatalogContext", () => ({
  useOptionalTaskCatalog: () => optionalCatalog.current,
}));

vi.mock("../../../components/items/emoji/emojiPickerLoader", () => ({
  scheduleEmojiPickerPreload: vi.fn(),
}));

vi.mock("./ItemForm", () => ({
  ItemForm: (props: { worksets: Workset[] }) =>
    createElement("div", {
      "data-testid": "item-form-worksets",
      "data-names": props.worksets.map((row) => row.name).join(","),
    }),
}));

vi.mock("./ItemFormToolbar", () => ({
  ItemFormToolbar: () => createElement("div", { "data-testid": "item-form-toolbar" }),
}));

import { listItemCategories } from "../../../api/items";
import { listWorksets } from "../../../api/worksets";
import { ItemFormPage } from "./ItemFormPage";

const WORKSET: Workset = {
  id: "__general__",
  name: "General",
  isSystem: true,
  notifyEnabled: true,
  externalEnabled: true,
  cover: "",
  description: "",
  createdAt: "",
  updatedAt: "",
};

const CATALOG_WORKSET: Workset = {
  ...WORKSET,
  name: "General renamed",
};

function catalogValue(worksets: Workset[]): TaskCatalogContextValue {
  return {
    tasks: [],
    tasksLoading: false,
    taskLoadError: null,
    refreshTasks: vi.fn(async () => []),
    worksets,
    worksetsLoading: false,
    refreshWorksets: vi.fn(async () => worksets),
  };
}

describe("ItemFormPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    optionalCatalog.current = null;
    vi.mocked(listItemCategories).mockReset().mockResolvedValue([]);
    vi.mocked(listWorksets).mockReset().mockResolvedValue([WORKSET]);
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
    optionalCatalog.current = null;
  });

  async function renderPage() {
    await act(async () => {
      root = createRoot(container);
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/items/new"] },
          createElement(
            Routes,
            null,
            createElement(Route, { path: "/items/new", element: createElement(ItemFormPage) }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("falls back to listWorksets when TaskCatalog is not mounted", async () => {
    await renderPage();
    expect(listWorksets).toHaveBeenCalledTimes(1);
    const node = container.querySelector("[data-testid='item-form-worksets']");
    expect(node?.getAttribute("data-names")).toBe("General");
  });

  it("uses TaskCatalog worksets and skips listWorksets when the provider is mounted", async () => {
    optionalCatalog.current = catalogValue([CATALOG_WORKSET]);
    await renderPage();
    expect(listWorksets).not.toHaveBeenCalled();
    const node = container.querySelector("[data-testid='item-form-worksets']");
    expect(node?.getAttribute("data-names")).toBe("General renamed");
  });
});
