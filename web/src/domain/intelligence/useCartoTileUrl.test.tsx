import { act, createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAP_CARTO_API_KEY_STORAGE_KEY } from "../prefs";
import { CARTO_URL, writeCartoApiKey } from "./mapTiles";
import { useCartoTileUrl } from "./useCartoTileUrl";
import { createTestHarness } from "../../test/render-helpers";

function CartoUrlProbe() {
  const url = useCartoTileUrl();
  return createElement("div", { "data-testid": "carto-url" }, url);
}

describe("useCartoTileUrl", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts from the watermarked URL and updates after a saved key", async () => {
    const harness = createTestHarness();
    await harness.render(CartoUrlProbe);
    expect(harness.container.querySelector('[data-testid="carto-url"]')?.textContent).toBe(
      CARTO_URL,
    );

    await act(async () => {
      writeCartoApiKey("live-key");
    });
    expect(harness.container.querySelector('[data-testid="carto-url"]')?.textContent).toBe(
      `${CARTO_URL}?key=live-key`,
    );
    expect(localStorage.getItem(MAP_CARTO_API_KEY_STORAGE_KEY)).toBe("live-key");
    harness.cleanup();
  });
});
