import { PlatformIcon } from "./PlatformIcon";
import {
  platformTagBaseClass,
  platformTagColorStyle,
} from "../../styles/cardTagClasses";
import { platformDisplayLabel } from "../../utils/platformRegistry";

interface PlatformTagProps {
  platform: string;
  size?: number;
  className?: string;
  role?: string;
}

/** Compact platform icon chip used on cards and list rows. */
export function PlatformTag({ platform, size = 9, className, role }: PlatformTagProps) {
  return (
    <span
      className={[platformTagBaseClass, className].filter(Boolean).join(" ")}
      role={role}
      style={platformTagColorStyle(platform)}
      title={platformDisplayLabel(platform)}
      aria-label={platformDisplayLabel(platform)}
    >
      <PlatformIcon platform={platform} size={size} />
    </span>
  );
}
