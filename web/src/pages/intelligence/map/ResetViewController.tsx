import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import {
  INTELLIGENCE_MAP_DEFAULT_CENTER,
  INTELLIGENCE_MAP_DEFAULT_ZOOM,
} from "../../../domain/intelligence/mapPresentation";

interface ResetViewControllerProps {
  trigger: number;
}

export function ResetViewController({ trigger }: ResetViewControllerProps) {
  const map = useMap();
  const prev = useRef(trigger);
  useEffect(() => {
    if (trigger !== prev.current) {
      prev.current = trigger;
      map.setView(INTELLIGENCE_MAP_DEFAULT_CENTER, INTELLIGENCE_MAP_DEFAULT_ZOOM);
    }
  }, [trigger, map]);
  return null;
}
