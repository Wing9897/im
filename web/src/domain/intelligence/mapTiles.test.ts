import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAP_CARTO_API_KEY_STORAGE_KEY } from "../prefs";
import {
  CARTO_URL,
  cartoTileUrl,
  readCartoApiKey,
  writeCartoApiKey,
} from "./mapTiles";

describe("cartoTileUrl", () => {
  it("keeps the public watermarked URL when no key is set", () => {
    expect(cartoTileUrl()).toBe(CARTO_URL);
    expect(cartoTileUrl(null)).toBe(CARTO_URL);
    expect(cartoTileUrl("")).toBe(CARTO_URL);
    expect(cartoTileUrl("   ")).toBe(CARTO_URL);
  });

  it("appends ?key= when the user has a key", () => {
    expect(cartoTileUrl("abc123")).toBe(`${CARTO_URL}?key=abc123`);
  });

  it("trims whitespace and encodes reserved characters", () => {
    expect(cartoTileUrl("  abc+def  ")).toBe(`${CARTO_URL}?key=abc%2Bdef`);
  });
});

describe("carto API key persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("round-trips a saved key through localStorage", () => {
    expect(readCartoApiKey()).toBe("");
    expect(writeCartoApiKey("  carto-key-1  ")).toBe("carto-key-1");
    expect(localStorage.getItem(MAP_CARTO_API_KEY_STORAGE_KEY)).toBe("carto-key-1");
    expect(readCartoApiKey()).toBe("carto-key-1");
  });

  it("clears storage when the saved key is empty", () => {
    writeCartoApiKey("keep-me");
    writeCartoApiKey("   ");
    expect(localStorage.getItem(MAP_CARTO_API_KEY_STORAGE_KEY)).toBeNull();
    expect(readCartoApiKey()).toBe("");
  });
});
