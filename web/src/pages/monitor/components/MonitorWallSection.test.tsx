import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockShowToast } from "../../../test/context-mocks";
import { i18n, wrapWithI18n } from "../../../test/i18nHarness";

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../../components/monitor/wall/useWallMediaCache", () => ({
  useWallMediaCache: () => ({
    get: vi.fn(),
    put: vi.fn(),
    revokeExcept: vi.fn(),
  }),
}));

vi.mock("../../../components/monitor/wall/useWallData", () => ({
  useWallData: () => ({
    channelById: {},
    selectedChannelIds: [],
    setSelectedChannelIds: vi.fn(),
    slots: {},
    initialLoading: false,
    isRefreshing: false,
    error: null,
    retryBootstrap: vi.fn(),
    advanceSlot: vi.fn(),
    setSlotIndex: vi.fn(),
  }),
}));

vi.mock("../../../components/monitor/wall/WallChannelPicker", () => ({
  WallChannelPicker: () => <div data-testid="wall-channel-picker" />,
}));

vi.mock("../../../components/monitor/wall/WallCard", () => ({
  WallCard: () => null,
}));

vi.mock("./MonitorToolbar", () => ({
  MonitorToolbar: ({ statusLabel }: { statusLabel: string }) => (
    <div data-testid="monitor-toolbar">{statusLabel}</div>
  ),
}));

import { MonitorWallSection } from "./MonitorWallSection";

describe("MonitorWallSection", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockShowToast.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("toasts metadata errors and shows wall empty chrome", async () => {
    await act(async () => {
      root.render(
        wrapWithI18n(createElement(MonitorWallSection, {
            viewMode: "wall",
            onViewModeChange: vi.fn(),
            channels: [],
            totalCount: 0,
            statsLoading: false,
            metadataError: String(i18n.t("monitor:metadata.loadError")),
            onRetryMetadata: vi.fn(),
          })),
      );
      await Promise.resolve();
    });

    expect(mockShowToast).toHaveBeenCalledWith(
      String(i18n.t("monitor:metadata.loadError")),
      "error",
    );
    expect(container.textContent).toContain("尚未選擇頻道");
    expect(container.textContent).toContain("訊息牆 · 請選擇頻道");
  });
});
