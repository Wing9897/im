export const AUTO_READ_VISIBILITY_THRESHOLD = 0.6;
export const AUTO_READ_DELAY_MS = 2500;

const TASK_COLORS = [
  "var(--success)",
  "var(--info)",
  "var(--accent)",
  "var(--peach)",
  "var(--warning)",
  "var(--error)",
  "var(--lavender)",
  "var(--accent-pink)",
];

export function taskColor(taskName: string | null): string {
  if (!taskName) return TASK_COLORS[0];
  let hash = 0;
  for (let i = 0; i < taskName.length; i++) {
    hash = ((hash << 5) - hash + taskName.charCodeAt(i)) | 0;
  }
  return TASK_COLORS[Math.abs(hash) % TASK_COLORS.length];
}

/** Applied to intelligence feed cards when the item has been read. */
export const cardReadClass =
  "opacity-[0.55] bg-[color-mix(in_srgb,var(--surface-card)_55%,transparent)]";
