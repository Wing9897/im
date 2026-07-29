import type { ReactNode } from "react";

interface MasterDetailSplitProps {
  list: ReactNode;
  /** Inline preview panel content (already wrapped in DetailPreviewPanel by the dialog view). */
  detail?: ReactNode | null;
  /** When true, render list + sticky preview side by side. */
  split: boolean;
}

/**
 * Linear/Cursor-style master–detail: list stays visible; detail docks on the right.
 */
export function MasterDetailSplit({ list, detail, split }: MasterDetailSplitProps) {
  if (!split || detail == null) {
    return <>{list}</>;
  }

  return (
    <div
      className="flex min-h-0 items-start gap-md"
      data-testid="master-detail-split"
    >
      <div className="min-w-0 flex-1">{list}</div>
      <aside
        className="im-preview-panel sticky top-0 flex h-[min(78vh,720px)] w-[min(420px,38vw)] shrink-0 flex-col overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--surface-border)_88%,transparent)] bg-[color-mix(in_srgb,var(--surface-card)_96%,transparent)] shadow-[var(--shadow-sm)]"
      >
        {detail}
      </aside>
    </div>
  );
}
