import { MAP_CARTO_API_KEY_EVENT, MAP_CARTO_API_KEY_STORAGE_KEY } from "../prefs";

/** CARTO dark basemap tiles shared by MapView and MapBoardEmbed. */
export const CARTO_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const CARTO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export function normalizeCartoApiKey(raw: string | null | undefined): string {
  return (raw ?? "").trim();
}

/** Leaflet tile URL. Empty / missing key keeps the watermarked public tiles. */
export function cartoTileUrl(apiKey?: string | null): string {
  const key = normalizeCartoApiKey(apiKey);
  if (!key) return CARTO_URL;
  return `${CARTO_URL}?key=${encodeURIComponent(key)}`;
}

export function readCartoApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return normalizeCartoApiKey(window.localStorage.getItem(MAP_CARTO_API_KEY_STORAGE_KEY));
  } catch {
    return "";
  }
}

export function writeCartoApiKey(apiKey: string | null | undefined): string {
  const key = normalizeCartoApiKey(apiKey);
  if (typeof window !== "undefined") {
    try {
      if (key) {
        window.localStorage.setItem(MAP_CARTO_API_KEY_STORAGE_KEY, key);
      } else {
        window.localStorage.removeItem(MAP_CARTO_API_KEY_STORAGE_KEY);
      }
    } catch {
      // quota / private mode — still notify listeners so in-memory maps can retry
    }
    window.dispatchEvent(new Event(MAP_CARTO_API_KEY_EVENT));
  }
  return key;
}
