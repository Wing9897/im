import { AlignLeft, Clock, MapPin } from "lucide-react";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import { CardFieldRow, CardTitleIcon, CARD_TITLE_ICON_PROPS } from "./CardFieldRow";

describe("CardFieldRow", () => {
  it("renders leading Lucide mark and keeps the caption text", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(CardFieldRow, {
          icon: Clock,
          text: "09:00",
          testId: "field-when",
        }),
      );
    });
    const row = container.querySelector('[data-testid="field-when"]');
    expect(row).toBeTruthy();
    expect(row?.querySelector("svg")).toBeTruthy();
    expect(row?.textContent).toBe("09:00");
  });

  it("keeps empty copy and uses a muted location mark", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(CardFieldRow, {
          icon: MapPin,
          text: "地點：N/A",
          empty: true,
          testId: "field-location",
        }),
      );
    });
    expect(container.querySelector('[data-testid="field-location"]')?.textContent).toBe(
      "地點：N/A",
    );
    expect(container.querySelector("svg")?.classList.contains("text-text-muted")).toBe(true);
  });

  it("clamps notes without dropping the AlignLeft mark", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(CardFieldRow, {
          icon: AlignLeft,
          text: "帶筆電",
          clamp: true,
          testId: "field-notes",
        }),
      );
    });
    const row = container.querySelector('[data-testid="field-notes"]');
    expect(row?.className).toContain("items-start");
    expect(row?.textContent).toBe("帶筆電");
  });
});

describe("CardTitleIcon", () => {
  it("renders a 20px title mark, larger than field-row icons", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(createElement(CardTitleIcon, { icon: Clock }));
    });
    const svg = container.querySelector('[data-testid="card-title-icon"]');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("width")).toBe(String(CARD_TITLE_ICON_PROPS.size));
    expect(CARD_TITLE_ICON_PROPS.size).toBeGreaterThan(14);
  });
});
