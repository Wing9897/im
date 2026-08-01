import { User } from "lucide-react";

import { AiStaffAvatar } from "../aiStaff/AiStaffAvatar";
import type { AiStaffId } from "../../domain/aiStaff/aiStaff";

/** User-side avatar for a caption row: custom image when set, glyph otherwise. */
export function DirectUserAvatar({
  label,
  src,
}: {
  label: string;
  src: string | null;
}) {
  const imageSrc = src?.trim() || "";
  return (
    <span
      className="im-assistant-direct__user-avatar mt-0.5 shrink-0"
      role="img"
      aria-label={label}
      data-testid="assistant-direct-user-avatar"
      data-custom-src={imageSrc ? "true" : undefined}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" width={28} height={28} draggable={false} />
      ) : (
        <User size={14} strokeWidth={2.2} aria-hidden="true" />
      )}
    </span>
  );
}

/** Assistant-side avatar for a caption row (mic, sending, and reply rows). */
export function DirectAssistantAvatar({
  label,
  src,
}: {
  label: string;
  src: string | null;
}) {
  return (
    <AiStaffAvatar
      staffId="assistant"
      size="sm"
      label={label}
      src={src}
      className="mt-0.5 shrink-0"
    />
  );
}

/** Generic AI-staff avatar for caption chrome (e.g. task advisor presence). */
export function DirectStaffAvatar({
  staffId,
  label,
  src = null,
}: {
  staffId: AiStaffId;
  label: string;
  src?: string | null;
}) {
  return (
    <AiStaffAvatar
      staffId={staffId}
      size="sm"
      label={label}
      src={src}
      className="mt-0.5 shrink-0"
    />
  );
}
