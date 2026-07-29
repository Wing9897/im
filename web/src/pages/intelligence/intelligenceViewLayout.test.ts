import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { FeedCard } from "../../components/ui";
import { mapDanmakuContentClass, mapLiveInfoContentClass } from "./map/mapViewClasses";

describe("Intelligence view styles", () => {
  it("FeedCard body uses line-clamp without webkit box hacks", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(FeedCard, { body: "Sample summary text for clamp testing." }),
      );
    });
    const body = container.querySelector(".line-clamp-3");
    expect(body).not.toBeNull();
    expect(body!.className).toContain("line-clamp-3");
  });

  it("map overlay content uses overflow clamp instead of webkit line clamp", () => {
    expect(mapDanmakuContentClass).toContain("max-h-[2.7em]");
    expect(mapDanmakuContentClass).toContain("overflow-hidden");
    expect(mapDanmakuContentClass).not.toContain("WebkitLineClamp");
    expect(mapLiveInfoContentClass).toContain("max-h-[3.6em]");
    expect(mapLiveInfoContentClass).toContain("overflow-hidden");
  });
});
