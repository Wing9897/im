import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTaskCatalogState, taskCatalogState } from "../test/context-mocks";
import { WorksetSummaryCard } from "./WorksetSummaryCard";

const updateWorkset = vi.fn(() => Promise.resolve({}));
const onOpen = vi.fn();

vi.mock("../api/worksets", () => ({
  updateWorkset: (...args: unknown[]) => updateWorkset(...args),
}));

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock());

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());

vi.mock("react-i18next", () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (ns === "workset" || ns === "common") {
        if (key === "notifyToggle" || key === "workset:notifyToggle") return "Notify";
        if (key === "externalToggle" || key === "workset:externalToggle") return "External API";
        if (key === "notifyToggleAria" || key === "workset:notifyToggleAria") {
          return `Notify ${opts?.name ?? ""}`;
        }
        if (key === "externalToggleAria" || key === "workset:externalToggleAria") {
          return `External ${opts?.name ?? ""}`;
        }
        if (key === "workset:openDetailAria") return `Open ${opts?.name ?? ""}`;
        if (key === "workset:systemBadge") return "Built-in";
        if (key === "workset:label") return "Workset";
        if (key === "workset:systemDescription") return "system";
        if (key === "workset:assetSummary") return `${opts?.tasks} tasks`;
        if (key === "workset:rename") return "rename";
        if (key === "workset:delete") return "delete";
      }
      return key;
    },
  }),
}));

describe("WorksetSummaryCard", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    resetTaskCatalogState();
    taskCatalogState.worksets = [
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
    updateWorkset.mockClear();
    onOpen.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container.remove();
  });

  it("toggles notify and external without opening the workset detail", async () => {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <WorksetSummaryCard
          id="ws-1"
          title="Ops"
          isSystem={false}
          taskCount={1}
          onOpen={onOpen}
        />,
      );
    });

    const notify = container.querySelector<HTMLButtonElement>('[data-testid="workset-notify-toggle-ws-1"]');
    const external = container.querySelector<HTMLButtonElement>(
      '[data-testid="workset-external-toggle-ws-1"]',
    );
    expect(notify).not.toBeNull();
    expect(external).not.toBeNull();
    await act(async () => {
      notify!.click();
    });
    expect(updateWorkset).toHaveBeenCalledWith("ws-1", { notifyEnabled: false });
    expect(onOpen).not.toHaveBeenCalled();
    await act(async () => {
      external!.click();
    });
    expect(updateWorkset).toHaveBeenCalledWith("ws-1", { externalEnabled: false });
    expect(onOpen).not.toHaveBeenCalled();
  });
});
