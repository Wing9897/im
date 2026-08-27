import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetTaskCatalogState, taskCatalogState } from "../test/context-mocks";
import { WorksetSummaryCard } from "./WorksetSummaryCard";
import "./items/emoji/emojiPickerReactMock";

const updateWorkset = vi.fn(() => Promise.resolve({}));
const onOpen = vi.fn();
const onRename = vi.fn(() => Promise.resolve());
const onDelete = vi.fn();

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
        if (key === "workset:renameAria") return `Rename ${opts?.name ?? ""}`;
        if (key === "workset:delete") return "delete";
        if (key === "workset:deleteAria") return `Delete ${opts?.name ?? ""}`;
        if (key === "workset:nameAria") return "Workset name";
        if (key === "workset:changeEmojiAria") return `Change emoji ${opts?.name ?? ""}`;
        if (key === "changeEmojiAria") return `Change emoji ${opts?.name ?? ""}`;
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
        emoji: "🎯",
        description: "Ops notes that should appear truncated on the card",
      },
    ];
    updateWorkset.mockClear();
    onOpen.mockClear();
    onRename.mockClear();
    onDelete.mockClear();
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

  async function renderCard(props: Partial<Parameters<typeof WorksetSummaryCard>[0]> = {}) {
    await act(async () => {
      root = createRoot(container);
      root.render(
        <WorksetSummaryCard
          id="ws-1"
          title="Ops"
          isSystem={false}
          taskCount={1}
          onOpen={onOpen}
          onRename={onRename}
          onDelete={onDelete}
          {...props}
        />,
      );
    });
  }

  it("puts a 48px emoji avatar beside the workset name", async () => {
    await renderCard({ onRename: undefined, onDelete: undefined });
    const avatar = container.querySelector('[data-testid="item-emoji-avatar"]') as HTMLElement | null;
    expect(avatar).toBeTruthy();
    expect(avatar?.style.width).toBe("48px");
    expect(avatar?.textContent).toContain("🎯");
    expect(container.querySelector('[data-testid="card-title-icon"]')).toBeNull();
  });

  it("shows a truncated custom description", async () => {
    await renderCard({ onRename: undefined, onDelete: undefined });
    expect(container.textContent ?? "").toContain("Ops notes that should appear truncated on the card");
  });

  it("toggles notify and external without opening the workset detail", async () => {
    await renderCard({ onRename: undefined, onDelete: undefined });

    const notify = container.querySelector<HTMLButtonElement>('[data-testid="workset-notify-toggle-ws-1"]');
    const external = container.querySelector<HTMLButtonElement>(
      '[data-testid="workset-external-toggle-ws-1"]',
    );
    expect(notify).not.toBeNull();
    expect(external).not.toBeNull();
    expect(notify!.getAttribute("aria-label")).toBe("Notify Ops");
    expect(external!.getAttribute("aria-label")).toBe("External Ops");
    expect(notify!.textContent ?? "").not.toContain("Notify");
    expect(external!.textContent ?? "").not.toContain("External API");
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

  it("puts rename and delete icon buttons next to the name, not as text", async () => {
    await renderCard();

    const rename = container.querySelector<HTMLButtonElement>('[data-testid="workset-card-rename-ws-1"]');
    const del = container.querySelector<HTMLButtonElement>('[data-testid="workset-card-delete-ws-1"]');
    expect(rename).not.toBeNull();
    expect(del).not.toBeNull();
    expect(rename!.getAttribute("aria-label")).toBe("Rename Ops");
    expect(del!.getAttribute("aria-label")).toBe("Delete Ops");
    expect(container.textContent ?? "").not.toContain("rename");
    expect(container.textContent ?? "").not.toContain("delete");
  });

  it("does not show rename or delete on the builtin workset", async () => {
    await renderCard({
      id: "__general__",
      title: "一般",
      isSystem: true,
      onRename: undefined,
      onDelete: undefined,
    });

    expect(container.querySelector('[data-testid="workset-card-rename-__general__"]')).toBeNull();
    expect(container.querySelector('[data-testid="workset-card-delete-__general__"]')).toBeNull();
  });

  it("enters inline rename, saves on Enter, then leaves edit mode", async () => {
    await renderCard();

    const rename = container.querySelector<HTMLButtonElement>('[data-testid="workset-card-rename-ws-1"]')!;
    await act(async () => {
      rename.click();
    });
    expect(onOpen).not.toHaveBeenCalled();

    const input = container.querySelector<HTMLInputElement>('[data-testid="workset-card-rename-input-ws-1"]');
    expect(input).not.toBeNull();
    const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      nativeSetter?.call(input, "Ops 2");
      input!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });

    expect(onRename).toHaveBeenCalledWith("Ops 2");
    expect(container.querySelector('[data-testid="workset-card-rename-input-ws-1"]')).toBeNull();
  });

  it("does not open the workset when clicking delete", async () => {
    await renderCard();

    const del = container.querySelector<HTMLButtonElement>('[data-testid="workset-card-delete-ws-1"]')!;
    await act(async () => {
      del.click();
    });
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
