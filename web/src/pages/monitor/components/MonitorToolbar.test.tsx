import { describe, it, expect, beforeEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { MonitorToolbar } from "./MonitorToolbar";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

function renderToolbar(viewMode: "list" | "card" | "wall") {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      wrapWithI18n(
        createElement(MonitorToolbar, {
          viewMode,
          onViewModeChange: () => {},
          statusLabel: "Loaded 40 / 120",
        }),
      ),
    );
  });
  return container;
}

describe("MonitorToolbar list contrast", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
  });

  it("brightens the load-count header only in list mode", () => {
    const list = renderToolbar("list");
    const listStatus = Array.from(list.querySelectorAll("span")).find((el) =>
      el.textContent?.includes("Loaded 40"),
    );
    expect(listStatus?.className).toContain("im-monitor-stream-status");
    expect(listStatus?.className).toContain("text-text-secondary");
    expect(listStatus?.className).not.toContain("text-text-muted");

    const cards = renderToolbar("card");
    const cardStatus = Array.from(cards.querySelectorAll("span")).find((el) =>
      el.textContent?.includes("Loaded 40"),
    );
    expect(cardStatus?.className).toContain("text-text-muted");
    expect(cardStatus?.className).not.toContain("im-monitor-stream-status");
  });
});
