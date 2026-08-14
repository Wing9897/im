import { act, createElement, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runtimeState } = vi.hoisted(() => ({
  runtimeState: {
    lastMessagesUpdate: null as {
      payload: { messages: import("../../../types").Message[] };
      receivedAt: number;
    } | null,
  },
}));

vi.mock("../../../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => runtimeState,
}));

import { useMonitorSseMerge } from "./useMonitorSseMerge";
import { makeMessage } from "../../../test/messageFixtures";
import type { Message, MessageFilters } from "../../../types";

interface HarnessState {
  totalCount: number;
  messages: Message[];
  setFilters: (filters: MessageFilters) => void;
}

let latest: HarnessState | null = null;

function Harness({ streamEnabled }: { streamEnabled: boolean }) {
  const [filters, setFilters] = useState<MessageFilters>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const messagesRef = useRef<Message[]>([]);

  useMonitorSseMerge({
    filters,
    streamEnabled,
    messagesRef,
    setMessages,
    setTotalCount,
  });

  latest = { totalCount, messages, setFilters };
  return null;
}

describe("useMonitorSseMerge (wall mode count dedupe)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    latest = null;
    runtimeState.lastMessagesUpdate = null;
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

  async function render(streamEnabled = false) {
    await act(async () => {
      root.render(createElement(Harness, { streamEnabled }));
      await Promise.resolve();
    });
  }

  async function pushUpdate(messages: Message[]) {
    runtimeState.lastMessagesUpdate = {
      payload: { messages },
      receivedAt: Date.now(),
    };
    await render();
  }

  it("counts novel matching messages once per SSE payload", async () => {
    await render();
    await pushUpdate([makeMessage({ id: "w-1" }), makeMessage({ id: "w-2" })]);
    expect(latest!.totalCount).toBe(2);

    // Re-render with the same update object must not recount it.
    await render();
    expect(latest!.totalCount).toBe(2);
  });

  it("dedupes message ids repeated across distinct SSE payloads", async () => {
    await render();
    await pushUpdate([makeMessage({ id: "w-1" }), makeMessage({ id: "w-2" })]);
    expect(latest!.totalCount).toBe(2);

    await pushUpdate([makeMessage({ id: "w-2" }), makeMessage({ id: "w-3" })]);
    expect(latest!.totalCount).toBe(3);
  });

  it("does not recount the current payload when filters change", async () => {
    await render();
    await pushUpdate([makeMessage({ id: "w-1" }), makeMessage({ id: "w-2" })]);
    expect(latest!.totalCount).toBe(2);

    // Filter change re-runs the effect with the same lastMessagesUpdate;
    // messages still match the new filter but must not be counted again.
    await act(async () => {
      latest!.setFilters({ platform: "telegram" });
      await Promise.resolve();
    });
    expect(latest!.totalCount).toBe(2);
  });

  it("resets the seen-id set on filter change for future payloads", async () => {
    await render();
    await pushUpdate([makeMessage({ id: "w-1" })]);
    expect(latest!.totalCount).toBe(1);

    await act(async () => {
      latest!.setFilters({ platform: "telegram" });
      await Promise.resolve();
    });

    // New payload after the filter change: id counted against the new
    // server-fetched baseline even though it was seen under the old filter.
    await pushUpdate([makeMessage({ id: "w-1" })]);
    expect(latest!.totalCount).toBe(2);
  });

  it("skips non-matching messages", async () => {
    await render();
    await act(async () => {
      latest!.setFilters({ platform: "discord" });
      await Promise.resolve();
    });
    await pushUpdate([makeMessage({ id: "w-1", platform: "telegram" })]);
    expect(latest!.totalCount).toBe(0);
  });

  it("does not bump wall count in stream mode", async () => {
    await render(true);
    runtimeState.lastMessagesUpdate = {
      payload: { messages: [makeMessage({ id: "s-1" })] },
      receivedAt: Date.now(),
    };
    await render(true);
    // Stream mode merges into the list instead (covered by useMonitorData tests).
    expect(latest!.messages.map((message) => message.id)).toEqual(["s-1"]);
    expect(latest!.totalCount).toBe(1);
  });
});
