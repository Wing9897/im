import { act, createElement, useCallback, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import type { Message } from "../../types";
import { mockShowToast } from "../../test/context-mocks";
import { useMonitorSelectionUrl } from "./useMonitorSelectionUrl";

vi.mock("../../context/ToastContext", async () =>
  (await import("../../test/context-mocks")).toastContextModuleMock());

const MESSAGES: Message[] = [
  {
    id: "msg-1",
    sourceId: "a1",
    platform: "telegram",
    platformId: "1",
    channelName: "ch",
    platformMessageId: "p1",
    senderId: null,
    senderName: null,
    content: "one",
    timestamp: "2026-01-01T00:00:00Z",
    rawData: null,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "msg-2",
    sourceId: "a1",
    platform: "telegram",
    platformId: "1",
    channelName: "ch",
    platformMessageId: "p2",
    senderId: null,
    senderName: null,
    content: "two",
    timestamp: "2026-01-01T00:01:00Z",
    rawData: null,
    createdAt: "2026-01-01T00:01:00Z",
  },
];

function SecondDeepLinkHarness({ onHydrate }: { onHydrate: (message: Message) => void }) {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleHydrate = useCallback(
    (message: Message) => {
      onHydrate(message);
      setSelectedId(message.id);
    },
    [onHydrate],
  );

  useMonitorSelectionUrl({
    selectedId,
    messages: MESSAGES,
    onHydrate: handleHydrate,
    listBusy: false,
    listExhausted: true,
  });

  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "to-second-id",
      onClick: () => navigate("/monitor?id=msg-2"),
    },
    "second id",
  );
}

function MissingIdHarness({
  messages,
  onSearch,
  listBusy = false,
  listExhausted = true,
}: {
  messages: readonly Message[];
  onSearch: (search: string) => void;
  listBusy?: boolean;
  listExhausted?: boolean;
}) {
  const location = useLocation();

  useMonitorSelectionUrl({
    selectedId: null,
    messages,
    onHydrate: () => {},
    listBusy,
    listExhausted,
  });

  // Capture search after URL sync effects run.
  useEffect(() => {
    onSearch(location.search);
  }, [location.search, onSearch]);

  return null;
}

describe("useMonitorSelectionUrl", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mockShowToast.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("hydrates a second ?id= deep link while staying mounted", async () => {
    const onHydrate = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor?id=msg-1"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/monitor",
              element: createElement(SecondDeepLinkHarness, { onHydrate }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onHydrate).toHaveBeenCalledTimes(1);
    expect(onHydrate.mock.calls[0][0].id).toBe("msg-1");
    onHydrate.mockClear();

    await act(async () => {
      (container.querySelector('[data-testid="to-second-id"]') as HTMLButtonElement).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onHydrate).toHaveBeenCalledTimes(1);
    expect(onHydrate.mock.calls[0][0].id).toBe("msg-2");
  });

  it("clears ?id= and toasts when the exhausted list has no match", async () => {
    let lastSearch = "";

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor?id=missing-msg"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/monitor",
              element: createElement(MissingIdHarness, {
                messages: MESSAGES,
                listBusy: false,
                listExhausted: true,
                onSearch: (search) => {
                  lastSearch = search;
                },
              }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockShowToast).toHaveBeenCalledWith("找不到指定的訊息", "warning");
    expect(new URLSearchParams(lastSearch).get("id")).toBeNull();
  });

  it("keeps ?id= pending while more pages may still contain the message", async () => {
    let lastSearch = "";

    await act(async () => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: ["/monitor?id=missing-msg"] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: "/monitor",
              element: createElement(MissingIdHarness, {
                messages: MESSAGES,
                listBusy: false,
                listExhausted: false,
                onSearch: (search) => {
                  lastSearch = search;
                },
              }),
            }),
          ),
        ),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(new URLSearchParams(lastSearch).get("id")).toBe("missing-msg");
  });
});
