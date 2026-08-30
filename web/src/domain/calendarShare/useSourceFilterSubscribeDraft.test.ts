import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeCalendarIdentity } from "./subscribedCalendars";
import { useSourceFilterSubscribeDraft } from "./useSourceFilterSubscribeDraft";

const CALENDARS = [
  subscribeCalendarIdentity({ handle: "Alice", slug: "Work" }),
  subscribeCalendarIdentity({ handle: "Carol", slug: "Team" }),
];

type DraftArgs = Parameters<typeof useSourceFilterSubscribeDraft>[0];
type DraftResult = ReturnType<typeof useSourceFilterSubscribeDraft>;

function Probe({
  args,
  onResult,
}: {
  args: DraftArgs;
  onResult: (value: DraftResult) => void;
}) {
  onResult(useSourceFilterSubscribeDraft(args));
  return null;
}

describe("useSourceFilterSubscribeDraft", () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: DraftResult | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render(args: DraftArgs) {
    act(() => {
      root.render(createElement(Probe, { args, onResult: (value) => { latest = value; } }));
    });
  }

  it("badges subscribe keys only when the catalog has those calendars", () => {
    const applyLocal = vi.fn();
    render({
      open: false,
      subscribeCalendars: CALENDARS,
      selectedSubscribeKeys: ["Alice/Work"],
      localIsFiltering: false,
      localFilterBadgeCount: 0,
      localApplyDisabled: true,
      applyLocal,
    });
    expect(latest?.filterBadgeCount).toBe(1);
    expect(latest?.isFiltering).toBe(true);
    expect(latest?.subscribeCatalogReady).toBe(true);

    render({
      open: false,
      subscribeCalendars: [],
      selectedSubscribeKeys: ["Alice/Work"],
      localIsFiltering: false,
      localFilterBadgeCount: 0,
      localApplyDisabled: true,
      applyLocal,
    });
    expect(latest?.filterBadgeCount).toBe(0);
    expect(latest?.isFiltering).toBe(false);
    expect(latest?.subscribeCatalogReady).toBe(false);
  });

  it("applies a dirty subscribe draft without resetting local apply", () => {
    const applyLocal = vi.fn();
    const onChangeSubscribeKeys = vi.fn();
    render({
      open: true,
      subscribeCalendars: CALENDARS,
      selectedSubscribeKeys: null,
      onChangeSubscribeKeys,
      localIsFiltering: false,
      localFilterBadgeCount: 0,
      localApplyDisabled: true,
      applyLocal,
    });
    act(() => {
      latest?.toggleKey("Alice/Work");
    });
    expect(latest?.applyDisabled).toBe(false);
    act(() => {
      latest?.apply();
    });
    expect(applyLocal).toHaveBeenCalledTimes(1);
    expect(onChangeSubscribeKeys).toHaveBeenCalledWith(["Carol/Team"]);
  });

  it("resets the subscribe draft when the dialog opens", () => {
    const applyLocal = vi.fn();
    render({
      open: false,
      subscribeCalendars: CALENDARS,
      selectedSubscribeKeys: ["Alice/Work"],
      localIsFiltering: false,
      localFilterBadgeCount: 0,
      localApplyDisabled: true,
      applyLocal,
    });
    act(() => {
      latest?.clearAllSubscribe();
    });
    expect(latest?.draftSubscribe).toEqual([]);
    render({
      open: true,
      subscribeCalendars: CALENDARS,
      selectedSubscribeKeys: ["Alice/Work"],
      localIsFiltering: false,
      localFilterBadgeCount: 0,
      localApplyDisabled: true,
      applyLocal,
    });
    expect(latest?.draftSubscribe).toEqual(["Alice/Work"]);
  });
});
