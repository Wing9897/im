import { useEffect, useState } from "react";
import { MAP_CARTO_API_KEY_EVENT } from "../prefs";
import { cartoTileUrl, readCartoApiKey } from "./mapTiles";

/** Live tile URL from the device-local key. Remounting the map view is enough. */
export function useCartoTileUrl(): string {
  const [url, setUrl] = useState(() => cartoTileUrl(readCartoApiKey()));

  useEffect(() => {
    const refresh = () => setUrl(cartoTileUrl(readCartoApiKey()));
    window.addEventListener(MAP_CARTO_API_KEY_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(MAP_CARTO_API_KEY_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return url;
}
