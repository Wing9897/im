import type { CSSProperties } from "react";
import { getAiStaff, type AiStaffId } from "../../domain/aiStaff/aiStaff";
import assistantSrc from "../../assets/ai-staff/assistant.png";
import taskEditorSrc from "../../assets/ai-staff/taskEditor.png";
import leaderboardSrc from "../../assets/ai-staff/leaderboard.png";
import eventIntelSrc from "../../assets/ai-staff/eventIntel.png";
import projectManagerSrc from "../../assets/ai-staff/projectManager.png";

const AVATAR_SRC: Record<AiStaffId, string> = {
  assistant: assistantSrc,
  taskEditor: taskEditorSrc,
  leaderboard: leaderboardSrc,
  eventIntel: eventIntelSrc,
  // MVP: reuse eventIntel artwork until a dedicated webIntel asset ships.
  webIntel: eventIntelSrc,
  projectManager: projectManagerSrc,
};

const SIZE_PX = {
  xs: 22,
  sm: 28,
  md: 36,
} as const;

type AiStaffAvatarProps = {
  staffId: AiStaffId;
  size?: keyof typeof SIZE_PX;
  className?: string;
  /** Accessible name; decorative when omitted. */
  label?: string;
  /** Optional image override (e.g. assistant custom avatar data URL). */
  src?: string | null;
};

export function AiStaffAvatar({
  staffId,
  size = "md",
  className = "",
  label,
  src,
}: AiStaffAvatarProps) {
  const staff = getAiStaff(staffId);
  const px = SIZE_PX[size];
  const style = {
    width: px,
    height: px,
  } as CSSProperties;
  const imageSrc = src?.trim() ? src : AVATAR_SRC[staffId];

  return (
    <span
      className={[
        "im-ai-staff-avatar inline-flex shrink-0 overflow-hidden rounded-full bg-transparent",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-testid={`ai-staff-avatar-${staffId}`}
      data-staff-kind={staff.kind}
      data-staff-surface={staff.surface}
      data-custom-src={src?.trim() ? "true" : undefined}
    >
      <img
        src={imageSrc}
        alt=""
        width={px}
        height={px}
        className="pointer-events-none h-full w-full border-0 object-cover"
        draggable={false}
      />
    </span>
  );
}
