import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import {
  SurfaceCard,
  type SurfaceCardEnter,
  type SurfaceCardMaterial,
} from "./SurfaceCard";

type AccentBarCardProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
  /** Tailwind background class for the 2px left accent rail. */
  accentClass?: string;
  /** Inline accent when color is dynamic (e.g. category hex). */
  accentStyle?: CSSProperties;
  children: ReactNode;
  material?: SurfaceCardMaterial;
  interactive?: boolean;
  enter?: SurfaceCardEnter;
  /** default = 12px pad; compact = tighter Items / list tiles. */
  density?: "default" | "compact";
};

/**
 * Entity card chrome: elevated surface + left accent rail + shared inner padding.
 * Replaces the repeated ``p-0`` SurfaceCard → re-pad body pattern.
 */
export function AccentBarCard({
  accentClass,
  accentStyle,
  children,
  material = "elevated",
  interactive = false,
  enter,
  density = "default",
  className,
  ...rest
}: AccentBarCardProps) {
  const bodyPad =
    density === "compact"
      ? "flex min-w-0 flex-1 flex-col gap-xs px-card-inner py-sm"
      : "flex min-w-0 flex-1 flex-col gap-sm px-card-inner py-md";

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
        className={["w-[2px] shrink-0 self-stretch", accentClass ?? ""].filter(Boolean).join(" ")}
        style={accentStyle}
        aria-hidden="true"
      />
      <div className={bodyPad}>{children}</div>
    </SurfaceCard>
  );
}
