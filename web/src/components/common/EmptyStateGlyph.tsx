import type { LucideIcon } from "lucide-react";

/** Compact accent Lucide mark for EmptyState `illustration` (same size as Items). */
export function EmptyStateGlyph({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon size={22} color="var(--accent)" strokeWidth={1.5} aria-hidden />;
}

/** Leading mark next to section / panel titles (flowchart-gate stroke). */
export function SectionHeaderIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon
      size={14}
      strokeWidth={2.25}
      className="shrink-0 text-text-muted"
      aria-hidden
    />
  );
}
