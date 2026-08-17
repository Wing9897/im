import type { ReactNode } from "react";
import { SurfaceCard, cardBodyClass, cardTitleClass } from "../../../../components/ui";

export function NotifySection({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <SurfaceCard material="panel" density="compact" className={className} role="region" aria-label={title}>
      <h3 className={`m-0 ${cardTitleClass}`}>{title}</h3>
      <p className={`mt-xs mb-md ${cardBodyClass}`}>{caption}</p>
      {children}
    </SurfaceCard>
  );
}
