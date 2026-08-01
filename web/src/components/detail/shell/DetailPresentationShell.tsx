import type { ReactNode } from "react";
import { DetailDialogShell, type DetailDialogVariant } from "./DetailDialogShell";
import { DetailPreviewPanel } from "./DetailPreviewPanel";

export type DetailPresentation = "modal" | "drawer" | "inline";

export interface DetailPresentationShellProps {
  presentation: DetailPresentation;
  onClose: () => void;
  "aria-label": string;
  children: ReactNode;
  /** Applied to the dialog shell, or wraps children inside the inline preview. */
  className?: string;
  width?: string;
  showCloseButton?: boolean;
}

function toDialogVariant(presentation: Exclude<DetailPresentation, "inline">): DetailDialogVariant {
  return presentation === "drawer" ? "drawer" : "modal";
}

/**
 * Routes detail content to inline preview vs modal/drawer overlay.
 * Body content stays page-specific — this only unifies the presentation branch.
 */
export function DetailPresentationShell({
  presentation,
  onClose,
  "aria-label": ariaLabel,
  children,
  className,
  width,
  showCloseButton,
}: DetailPresentationShellProps) {
  if (presentation === "inline") {
    return (
      <DetailPreviewPanel onClose={onClose} aria-label={ariaLabel}>
        <div className={className}>{children}</div>
      </DetailPreviewPanel>
    );
  }

  return (
    <DetailDialogShell
      className={className}
      width={width}
      variant={toDialogVariant(presentation)}
      onClose={onClose}
      showCloseButton={showCloseButton}
      aria-label={ariaLabel}
    >
      {children}
    </DetailDialogShell>
  );
}
