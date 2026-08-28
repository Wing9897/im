import { describe, expect, it } from "vitest";
import { CARTO_URL } from "../intelligence/mapTiles";
import { CARTO_API_KEY_DOCS_URL, SYSTEM_OUTBOUND_APIS } from "./systemOutboundApis";

describe("systemOutboundApis", () => {
  it("lists built-in outbound endpoints aligned with server providers", () => {
    const urls = SYSTEM_OUTBOUND_APIS.map((entry) => entry.url);
    expect(urls).toContain(CARTO_URL);
    expect(urls).toContain("https://geocoding-api.open-meteo.com/v1/search");
    expect(urls).toContain("https://api.open-meteo.com/v1/forecast");
    expect(urls).toContain("https://api.met.no/weatherapi/locationforecast/2.0/compact");
    expect(urls).toContain("https://wttr.in/{location}");
    expect(urls).toContain("https://nominatim.openstreetmap.org/search");
    expect(urls).toContain("https://www.bing.com/HPImageArchive.aspx");
    expect(urls).toContain("https://date.nager.at/api/v3/PublicHolidays/{year}/{country}");
    expect(CARTO_API_KEY_DOCS_URL).toBe("https://carto.com/basemaps/apikey");
  });

  it("groups weather fallbacks after Open-Meteo forecast", () => {
    const ids = SYSTEM_OUTBOUND_APIS.map((entry) => entry.id);
    const openMeteoForecastIdx = ids.indexOf("open-meteo-forecast");
    const metNoIdx = ids.indexOf("met-no-forecast");
    const wttrIdx = ids.indexOf("wttr-weather");
    expect(metNoIdx).toBe(openMeteoForecastIdx + 1);
    expect(wttrIdx).toBe(metNoIdx + 1);
  });
});
