import { describe, expect, it } from "vitest";

import { contentFadeClass } from "../../components/ui/pageLayout";
import {
  monitorStreamStatusLabel,
  monitorWallStatusLabel,
} from "./monitorStatusLabel";

describe("monitorPageStyles", () => {
  it("keeps content fade transition for list/card panes", () => {
    expect(contentFadeClass).toContain("im-content-fade");
    expect(contentFadeClass).toContain("opacity-100");
  });
});

describe("monitorStatusLabel", () => {
  it("formats stream status while paginating", () => {
    expect(
      monitorStreamStatusLabel({
        initialLoading: false,
        messagesLength: 50,
        totalCount: 200,
        hasMore: true,
      }),
    ).toBe("已載入 50 / 200 則訊息，向下捲動載入更多");
  });

  it("formats wall status for selected channels", () => {
    expect(monitorWallStatusLabel(3, false, 2800, false, 12)).toBe(
      "訊息牆 · 3 頻道 · 2,800 則 · 牆上 12",
    );
  });

  it("omits wall loaded suffix when queue is empty", () => {
    expect(monitorWallStatusLabel(2, false, 100, false, 0)).toBe(
      "訊息牆 · 2 頻道 · 100 則",
    );
  });

  it("formats stream status when all pages are loaded", () => {
    expect(
      monitorStreamStatusLabel({
        initialLoading: false,
        messagesLength: 500,
        totalCount: 500,
        hasMore: false,
      }),
    ).toBe("共 500 則訊息");
  });
});
