import type { HTMLAttributes, ReactNode } from "react";
import {
  SurfaceCard,
  type SurfaceCardEnter,
  type SurfaceCardMaterial,
} from "./SurfaceCard";

type AccentBarCardProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Tailwind background class for the 2px left accent rail. */
  accentClass: string;
  children: ReactNode;
  material?: SurfaceCardMaterial;
  interactive?: boolean;
  enter?: SurfaceCardEnter;
};

/**
 * Entity card chrome: elevated surface + left accent rail + shared inner padding.
 * Replaces the repeated ``p-0`` SurfaceCard → re-pad body pattern.
 */
export function AccentBarCard({
  accentClass,
  children,
  material = "elevated",
  interactive = false,
  enter,
  className,
  ...rest
}: AccentBarCardProps) {
  return (
    <SurfaceCard
      material={material}
      interactive={interactive}
      enter={enter}
      padding="none"
      className={["relative flex h-full min-w-0 overflow-hidden", className ?? ""]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <span
        className={`w-[2px] shrink-0 self-stretch ${accentClass}`}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-sm px-card-inner py-md">
        {children}
      </div>
    </SurfaceCard>
  );
}
