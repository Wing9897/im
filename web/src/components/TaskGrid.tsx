import type { ReactNode } from "react";
import { CardGrid } from "./ui";

interface TaskGridProps {
  children: ReactNode;
}

/** Compute grid column count based on viewport width — up to 4 on wide desktops. */
export function getColumnCount(width: number): number {
  if (width >= 1200) return 4;
  if (width >= 768) return 2;
  return 1;
}

/** Responsive task card grid — up to 4 columns on wide desktops. */
export function TaskGrid({ children }: TaskGridProps) {
  return <CardGrid>{children}</CardGrid>;
}
