/** Shared chat bubble Tailwind classes (assistant + task-editor). */

const BUBBLE_BASE =
  "rounded-lg px-md py-sm text-body leading-relaxed text-text-primary whitespace-pre-wrap break-words";

export function userChatBubbleClass(maxWidthRem: 36 | 42 | "full" = 42): string {
  const width =
    maxWidthRem === "full" ? "max-w-[85%]" : `max-w-[min(100%,${maxWidthRem}rem)]`;
  return [
    width,
    "ml-auto self-end",
    BUBBLE_BASE,
    "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
  ].join(" ");
}

export function assistantChatBubbleClass(maxWidthRem: 36 | 42 | "full" = 42): string {
  const width =
    maxWidthRem === "full" ? "w-full max-w-none" : `max-w-[min(100%,${maxWidthRem}rem)]`;
  return [
    width,
    BUBBLE_BASE,
    "border border-surface-border",
    "bg-[color-mix(in_srgb,var(--surface-card)_70%,var(--text-primary)_4%)]",
  ].join(" ");
}
