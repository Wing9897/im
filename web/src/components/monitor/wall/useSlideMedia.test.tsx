import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMessageMediaBlob } from "../../../api/messages";
import type { Message } from "../../../types";
import { makeMessage } from "../../../test/messageFixtures";
import { useSlideMedia } from "./useSlideMedia";

vi.mock("../../../api/messages", () => ({
  fetchMessageMediaBlob: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchMessageMediaBlob);
const getCachedUrl = () => undefined;
const putCachedUrl = (_messageId: string, objectUrl: string) => objectUrl;

function makePhotoMessage(id: string): Message {
  return makeMessage({
    id,
    platformMessageId: id,
    content: "",
    media: { kind: "photo", mime: "image/jpeg" },
  });
}

function Harness({ message }: { message: Message }) {
  const state = useSlideMedia({
    message,
    enabled: true,
    getCachedUrl,
    putCachedUrl,
  });
  return <span data-state={state.failed ? "failed" : state.loading ? "loading" : "ready"} />;
}

afterEach(() => {
  vi.useRealTimers();
  mockedFetch.mockReset();
  Reflect.deleteProperty(URL, "createObjectURL");
});

describe("useSlideMedia", () => {
  it("queues a fourth media request instead of reporting a false failure", async () => {
    vi.useFakeTimers();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:media"),
    });
    const resolvers: Array<(blob: Blob) => void> = [];
    mockedFetch.mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolvers.push(resolve);
        }),
    );

    const container = document.createElement("div");
    const root = createRoot(container);
    act(() => {
      root.render(
        <>
          {["m1", "m2", "m3", "m4"].map((id) => (
            <Harness key={id} message={makePhotoMessage(id)} />
          ))}
        </>,
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });

    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(Array.from(container.querySelectorAll("span")).every((node) => node.dataset.state === "loading")).toBe(
      true,
    );

    await act(async () => {
      resolvers[0](new Blob(["image"], { type: "image/jpeg" }));
      await Promise.resolve();
    });
    expect(mockedFetch).toHaveBeenCalledTimes(4);

    await act(async () => {
      for (const resolve of resolvers.slice(1)) {
        resolve(new Blob(["image"], { type: "image/jpeg" }));
      }
      await Promise.resolve();
    });
    act(() => root.unmount());
  });
});
