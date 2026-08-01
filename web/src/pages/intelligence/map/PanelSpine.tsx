import { useState } from "react";
import { mapPanelSpineClass, type PanelSpineVariant } from "./mapViewClasses";

export type { PanelSpineVariant };

interface PanelSpineProps {
  variant: PanelSpineVariant;
  label: string;
}

/** Vertical panel title on the colored left spine. */
export function PanelSpine({ variant, label }: PanelSpineProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={mapPanelSpineClass(variant, hovered)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
