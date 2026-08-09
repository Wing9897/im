import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Message } from "../../types";
import { wrapWithI18n } from "../../test/i18nHarness";

// REST API mocks for monitor page source/channel/message queries
const { mockListSources, mockListChannelsWithSources, mockQueryMessagesPage, runtimeState } = vi.hoisted(() => ({
  mockListSources: vi.fn(),
  mockListChannelsWithSources: vi.fn(),
  mockQueryMessagesPage: vi.fn(),
  runtimeState: {
    lastMessagesUpdate: null as {
      payload: {
        messages: Message[];
      };
      receivedAt: number;
    } | null,
  },
}));

vi.mock("../../api/sources", () => ({
  listSources: mockListSources,
}));

vi.mock("../../api/messages", () => ({
  queryMessagesPage: mockQueryMessagesPage,
}));

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: mockListChannelsWithSources,
}));

vi.mock("../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => runtimeState,
}));

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: "/monitor", search: "", state: null }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}));

vi.mock("./filter/FilterBar", () => ({
  FilterBar: () => null,
  FilterActiveChips: () => null,
}));

vi.mock("./components/MonitorViewToggle", () => ({
  MonitorViewToggle: () => null,
}));

vi.mock("./components/MonitorToolbar", () => ({
  MonitorToolbar: ({ statusLabel }: { statusLabel: React.ReactNode }) => (
    <div data-testid="monitor-toolbar">{statusLabel}</div>
  ),
}));

vi.mock("./components/MonitorWallSection", () => ({
  MonitorWallSection: () => null,
}));

vi.mock("../../components/common/SkeletonScreen", () => ({
  SkeletonScreen: () => <div data-testid="skeleton-screen" />,
}));

vi.mock("../../components/common/MessageCard", () => ({
  MessageCard: ({ message }: { message: Message }) => (
    <div data-testid="message-card">{message.id}</div>
  ),
}));

vi.mock("./message/MessageListItem", () => ({
  MessageListItem: ({ message }: { message: Message }) => (
    <div data-testid="message-list-item">{message.id}</div>
  ),
}));

import { MonitorPage } from "./MonitorPage";
import { makeMessage } from "../../test/messageFixtures";

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [];
  readonly disconnect = vi.fn();
  readonly observe = vi.fn();
  readonly takeRecords = vi.fn(() => []);
  readonly unobserve = vi.fn();

  constructor(_callback: IntersectionObserverCallback) {}
}

describe("MonitorPage", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.localStorage.clear();
    runtimeState.lastMessagesUpdate = null;
    mockListSources.mockReset();
    mockListChannelsWithSources.mockReset();
    mockQueryMessagesPage.mockReset();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
    }
    root = null;
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders SkeletonScreen during loading state instead of messages", async () => {
    // Make queryMessagesPage never resolve to keep loading state
    mockListSources.mockResolvedValue([
      {
        id: "source-1",
        platform: "telegram",
        name: "Source 1",
        status: "connected",
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      },
    ]);
    mockListChannelsWithSources.mockResolvedValue([]);
    mockQueryMessagesPage.mockReturnValue(new Promise(() => {}));

    await act(async () => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MonitorPage)),
      );
      await Promise.resolve();
    });

    // SkeletonScreen mock renders a div with data-testid="skeleton-screen"
    const skeleton = container.querySelector('[data-testid="skeleton-screen"]');
    expect(skeleton).toBeTruthy();

    // No message cards should be rendered during loading
    const messageCards = container.querySelectorAll('[data-testid="message-card"]');
    expect(messageCards.length).toBe(0);

    // Loading text should be visible
    expect(container.textContent).toContain("載入中…");
  });

  it("prepends only novel runtime messages that match the current filters", async () => {
    window.localStorage.setItem(
      "im:monitor:filters",
      JSON.stringify({ sourceIds: ["source-1"] }),
    );

    const existingMessage = makeMessage({ id: "message-existing", sourceId: "source-1" });
    const novelMatchingMessage = makeMessage({
      id: "message-new",
      sourceId: "source-1",
      platformMessageId: "platform-message-2",
      content: "new content",
    });
    const otherSourceMessage = makeMessage({
      id: "message-other-source",
      sourceId: "source-2",
      platformMessageId: "platform-message-3",
    });

    mockListSources.mockResolvedValue([
      {
        id: "source-1",
        platform: "telegram",
        name: "Source 1",
        status: "connected",
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      },
    ]);
    mockListChannelsWithSources.mockResolvedValue([
      {
        id: "channel-1",
        platform: "telegram",
        platformChannelId: "platform-channel-1",
        channelName: "Channel 1",
        createdAt: "2026-04-17T03:00:00.000Z",
      },
    ]);
    mockQueryMessagesPage.mockResolvedValue({
      messages: [existingMessage],
      nextCursor: null,
      hasMore: false,
      totalCount: 1,
    });

    await act(async () => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MonitorPage)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    runtimeState.lastMessagesUpdate = {
      payload: {
        messages: [existingMessage, otherSourceMessage, novelMatchingMessage],
      },
      receivedAt: 1,
    };

    await act(async () => {
      root!.render(
        wrapWithI18n(createElement(MonitorPage)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      Array.from(
        container.querySelectorAll('[data-testid="message-card"]'),
      ).map((node) => node.textContent),
    ).toEqual(["message-new", "message-existing"]);
    expect(container.textContent).toContain("共 2 則訊息");
  });

  it("appends new pages through the load-more action without duplicating existing messages", async () => {
    const firstPageMessage = makeMessage({ id: "message-1" });
    const secondPageMessage = makeMessage({
      id: "message-2",
      platformMessageId: "platform-message-2",
    });

    mockListSources.mockResolvedValue([
      {
        id: "source-1",
        platform: "telegram",
        name: "Source 1",
        status: "connected",
        createdAt: "2026-04-17T03:00:00.000Z",
        updatedAt: "2026-04-17T03:00:00.000Z",
      },
    ]);
    mockListChannelsWithSources.mockResolvedValue([
      {
        id: "channel-1",
        platform: "telegram",
        platformChannelId: "platform-channel-1",
        channelName: "Channel 1",
        createdAt: "2026-04-17T03:00:00.000Z",
      },
    ]);
    mockQueryMessagesPage.mockImplementation((args?: { cursor?: { id: string } | null }) => {
      if (!args?.cursor) {
        return Promise.resolve({
          messages: [firstPageMessage],
          nextCursor: {
            id: "cursor-1",
            timestamp: "2026-04-17T03:00:00.000Z",
          },
          hasMore: true,
          totalCount: 2,
        });
      }
      return Promise.resolve({
        messages: [firstPageMessage, secondPageMessage],
        nextCursor: null,
        hasMore: false,
        totalCount: 2,
      });
    });

    await act(async () => {
      root = createRoot(container);
      root.render(
        wrapWithI18n(createElement(MonitorPage)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const loadMoreButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "載入更多");
    expect(loadMoreButton).toBeTruthy();

    await act(async () => {
      loadMoreButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      Array.from(
        container.querySelectorAll('[data-testid="message-card"]'),
      ).map((node) => node.textContent),
    ).toEqual(["message-1", "message-2"]);
    expect(container.textContent).toContain("共 2 則訊息");
  });
});
