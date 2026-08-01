import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { DEFAULT_CENTER, DEFAULT_ZOOM } from "./mapViewHelpers";

interface ResetViewControllerProps {
  trigger: number;
}

export function ResetViewController({ trigger }: ResetViewControllerProps) {
  const map = useMap();
  const prev = useRef(trigger);
  useEffect(() => {
    if (trigger !== prev.current) {
      prev.current = trigger;
      map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [trigger, map]);
  return null;
}
