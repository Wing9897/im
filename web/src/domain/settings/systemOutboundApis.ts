import { CARTO_URL } from "../intelligence/mapTiles";

/** CARTO basemap API key signup — align with Settings → integrations → system panel. */
export const CARTO_API_KEY_DOCS_URL = "https://carto.com/basemaps/apikey";

/**
 * Read-only outbound URLs used by the desktop app.
 * Server mirrors: ``server/services/focal_background.py`` (Bing wallpaper),
 * ``server/services/weather_providers.py`` (Open-Meteo / met.no / wttr.in),
 * ``server/analyzer/geocoding.py`` (Nominatim),
 * ``server/services/holidays.py`` (Nager.Date).
 */
export type SystemOutboundApiEntry = {
  id: string;
  /** i18n key under ``settings.integrations.system.outbound`` */
  labelKey: string;
  url: string;
  /** Optional i18n help key under ``settings.integrations.system.outbound`` */
  helpKey?: string;
  docsUrl?: string;
};

export const SYSTEM_OUTBOUND_APIS: readonly SystemOutboundApiEntry[] = [
  {
    id: "carto-tiles",
    labelKey: "cartoTiles",
    url: CARTO_URL,
    helpKey: "cartoTilesHelp",
    docsUrl: CARTO_API_KEY_DOCS_URL,
  },
  {
    id: "open-meteo-geocoding",
    labelKey: "openMeteoGeocoding",
    url: "https://geocoding-api.open-meteo.com/v1/search",
    helpKey: "openMeteoGeocodingHelp",
  },
  {
    id: "open-meteo-forecast",
    labelKey: "openMeteoForecast",
    url: "https://api.open-meteo.com/v1/forecast",
    helpKey: "openMeteoForecastHelp",
  },
  {
    id: "met-no-forecast",
    labelKey: "metNoForecast",
    url: "https://api.met.no/weatherapi/locationforecast/2.0/compact",
    helpKey: "metNoForecastHelp",
  },
  {
    id: "wttr-weather",
    labelKey: "wttrWeather",
    url: "https://wttr.in/{location}",
    helpKey: "wttrWeatherHelp",
  },
  {
    id: "nominatim-geocoding",
    labelKey: "nominatimGeocoding",
    url: "https://nominatim.openstreetmap.org/search",
    helpKey: "nominatimGeocodingHelp",
  },
  {
    id: "bing-focal-background",
    labelKey: "bingFocalBackground",
    url: "https://www.bing.com/HPImageArchive.aspx",
    helpKey: "bingFocalBackgroundHelp",
  },
  {
    id: "nager-holidays",
    labelKey: "nagerHolidays",
    url: "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}",
    helpKey: "nagerHolidaysHelp",
  },
] as const;
