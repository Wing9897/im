/**
 * Unit tests for SettingsFieldGroup and SettingsContentCard.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";

vi.mock("../../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "stopped",
    aiEngineStatus: "unknown",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    queueStatus: null,
    analysisPaused: false,
    activeAnalyses: new Map(),
    lastAnalysisEvent: null,
    lastSourceStatusChange: null,
    lastMessagesUpdate: null,
    requestQueueStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../../context/runtimeLogs/RuntimeLogsContext", () => ({
  useRuntimeLogs: () => ({
    logs: [],
    totalLogCount: 0,
    hasMoreLogs: false,
    logsLoading: false,
    logsLoadingMore: false,
    logLoadError: null,
    clearLogs: vi.fn(),
    refreshLogs: vi.fn(),
    loadMoreLogs: vi.fn(),
  }),
}));

vi.mock("../../hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ current: null }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    NavLink: ({
      children,
      to,
      className,
    }: {
      children: React.ReactNode;
      to: string;
      className?: string | ((args: { isActive: boolean }) => string);
    }) => {
      const computedClass =
        typeof className === "function"
          ? className({ isActive: to === "/settings/theme" })
          : className;
      return createElement(
        "a",
        { href: to, className: computedClass, "data-testid": `navlink-${to}` },
        children,
      );
    },
    Outlet: () => createElement("div", { "data-testid": "outlet" }),
    useOutletContext: () => ({}),
    useLocation: () => ({
      pathname: "/settings/theme",
      search: "",
      hash: "",
      state: null,
      key: "default",
    }),
  };
});

import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "./SettingsShared";
import { SettingsSaveBar } from "../../components/settings/SettingsSaveBar";
import { SettingsTopTabs } from "../shared/WorkspaceShell";

describe("SettingsContentCard visual styles", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders a compact content card container", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsContentCard, null, "Content"));
    });

    const card = container.firstElementChild as HTMLElement;
    expect(card.tagName).toBe("DIV");
    expect(card.className).toContain("rounded-lg");
    expect(card.className).toContain("border");
  });

  it("renders children content inside the card", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          SettingsContentCard,
          null,
          createElement("span", { "data-testid": "child" }, "Child content"),
        ),
      );
    });

    const child = container.querySelector('[data-testid="child"]');
    expect(child).toBeTruthy();
    expect(child!.textContent).toBe("Child content");
  });
});

describe("SettingsFieldGroup visual styles", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("renders children without a section title row", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          SettingsFieldGroup,
          null,
          "Group content",
        ),
      );
    });

    expect(container.textContent).toContain("Group content");
    expect(container.querySelector("section")).toBeNull();
    expect(container.querySelector("h1,h2,h3")).toBeNull();
  });

  it("adds top spacing instead of a border when showDivider is true", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          SettingsFieldGroup,
          { showDivider: true },
          "Content",
        ),
      );
    });

    const group = container.firstElementChild as HTMLElement;
    expect(group.className).toContain("pt-lg");
    expect(group.className).not.toContain("border-t");
  });
});

describe("SettingsTopTabs visual styles", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("active tab has is-active class", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsTopTabs));
    });

    const activeTab = container.querySelector(
      '[data-testid="navlink-/settings/theme"]',
    ) as HTMLElement;
    expect(activeTab.classList.contains("is-active")).toBe(true);
  });

  it("inactive tab does not have is-active class", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsTopTabs));
    });

    const inactiveTab = container.querySelector(
      '[data-testid="navlink-/settings/data"]',
    ) as HTMLElement;
    expect(inactiveTab.classList.contains("is-active")).toBe(false);
  });

  it("renders segmented tab navigation container", () => {
    act(() => {
      root = createRoot(container);
      root.render(createElement(SettingsTopTabs));
    });

    const segmentedBar = container.querySelector("nav .relative.flex.w-full.overflow-hidden.rounded-md");
    expect(segmentedBar).toBeTruthy();
  });
});

describe("SettingsSaveBar", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(async () => {
    await i18n.changeLanguage("zh-Hant");
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
    }
    root = null;
    container.remove();
  });

  it("uses design-system Button for save action", () => {
    act(() => {
      root = createRoot(container);
      root.render(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(SettingsSaveBar, {
            saving: false,
            saveSuccess: false,
            saveLabel: "儲存設定",
            onSave: () => {},
          }),
        ),
      );
    });

    const saveButton = container.querySelector("button");
    expect(saveButton?.textContent).toBe("儲存設定");
    expect(saveButton?.className).toContain("bg-accent");
  });
});
