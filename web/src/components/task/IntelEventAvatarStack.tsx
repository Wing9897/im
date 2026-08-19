import { Radar } from "lucide-react";

import { lookupTaskEmojiForEvent, type TaskEmojiEventRef } from "../../domain/tasks/taskEmoji";
import {
  TaskLogoMark,
  TASK_EVENT_MARK_PX,
  TASK_LOGO_BADGE_PX,
  TASK_LOGO_COMPACT_BADGE_PX,
  TASK_LOGO_MARK_PX,
} from "./TaskLogoMark";

const OVERLAY_RING_CLASS = [
  "absolute bottom-0 right-0 overflow-hidden rounded-full",
  "bg-[var(--surface-card)]",
  "ring-1 ring-[color-mix(in_srgb,var(--surface-raised)_85%,var(--text-primary))]",
].join(" ");

export const INTEL_EVENT_STACK_SIZES = {
  /** Intelligence cards / detail — match enlarged task-card stack. */
  card: {
    largePx: TASK_LOGO_MARK_PX,
    smallPx: TASK_LOGO_BADGE_PX,
    offsetPx: 6,
  },
  /** Timeline sidebar list / selected-event title. */
  compact: {
    largePx: TASK_EVENT_MARK_PX,
    smallPx: TASK_LOGO_COMPACT_BADGE_PX,
    offsetPx: 4,
  },
} as const;

export type IntelEventAvatarSize = keyof typeof INTEL_EVENT_STACK_SIZES;

type StackProps = {
  emoji: string;
  size?: IntelEventAvatarSize;
  className?: string;
  /** Accessible name; decorative when omitted. */
  label?: string;
};

/**
 * Intel-event identity (not the task-card stack):
 * - large: 情報 Radar chip (never the task emoji / AI head)
 * - small: task-card large mark (ListChecks or entity `emoji`)
 */
export function IntelEventAvatarStack({
  emoji,
  size = "card",
  className = "",
  label,
}: StackProps) {
  const { largePx, smallPx, offsetPx } = INTEL_EVENT_STACK_SIZES[size];
  const stackPx = largePx + offsetPx;
  return (
    <span
      className={["relative inline-block shrink-0", className].filter(Boolean).join(" ")}
      style={{ width: stackPx, height: stackPx }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid="intel-event-avatar-stack"
    >
      <span className="absolute left-0 top-0">
        <TaskLogoMark
          emoji=""
          sizePx={largePx}
          fallbackIcon={Radar}
          testId="intel-event-mark"
        />
      </span>
      <span className={OVERLAY_RING_CLASS} data-testid="intel-event-task-badge">
        <TaskLogoMark emoji={emoji} sizePx={smallPx} />
      </span>
    </span>
  );
}

type MarkProps = {
  event: TaskEmojiEventRef;
  size?: IntelEventAvatarSize;
  className?: string;
  label?: string;
};

/** Timeline analysis rows: read entity `emoji` from the event payload. */
export function IntelEventMark({
  event,
  size = "compact",
  className,
  label,
}: MarkProps) {
  return (
    <IntelEventAvatarStack
      emoji={lookupTaskEmojiForEvent(event)}
      size={size}
      className={className}
      label={label}
    />
  );
}
