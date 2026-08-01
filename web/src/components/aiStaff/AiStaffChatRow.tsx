import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AiStaffAvatar } from "./AiStaffAvatar";
import type { AiStaffId } from "../../domain/aiStaff/aiStaff";
import {
  resolveAssistantDisplayName,
  useAssistantIdentity,
} from "../../domain/aiStaff/assistantIdentity";

type AiStaffChatRowProps = {
  staffId: AiStaffId;
  children?: ReactNode;
  className?: string;
  /** Shown above the bubble on denser task-editor layout */
  showName?: boolean;
  sendingLabel?: string;
  testId?: string;
};

/** Front-line AI message row: avatar + bubble. */
export function AiStaffChatRow({
  staffId,
  children,
  className = "",
  showName = false,
  sendingLabel,
  testId,
}: AiStaffChatRowProps) {
  const { t } = useTranslation("common");
  const { identity } = useAssistantIdentity();
  const fallbackName = t(`aiStaff.${staffId}`);
  const name =
    staffId === "assistant"
      ? resolveAssistantDisplayName(identity, fallbackName)
      : fallbackName;
  const avatarSrc = staffId === "assistant" ? identity.avatarDataUrl : null;

  return (
    <div
      className={["mr-auto flex max-w-[min(100%,42rem)] items-start gap-sm", className]
        .filter(Boolean)
        .join(" ")}
      data-testid={testId}
    >
      <AiStaffAvatar
        staffId={staffId}
        size="sm"
        label={name}
        src={avatarSrc}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        {showName ? (
          <div className="mb-xs text-caption font-semibold text-text-muted">{name}</div>
        ) : null}
        {sendingLabel ? (
          <div className="text-caption text-text-muted">{sendingLabel}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
