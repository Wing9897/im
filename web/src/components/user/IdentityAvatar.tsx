import type { CSSProperties } from "react";

import { resolveIdentityAvatar } from "../../domain/user/identityAvatar";

export type IdentityAvatarSize = "sm" | "md" | "lg";

const SIZE_PX: Record<IdentityAvatarSize, number> = {
  sm: 28,
  md: 40,
  lg: 56,
};

type IdentityAvatarProps = {
  label: string;
  src?: string | null;
  size?: IdentityAvatarSize;
  className?: string;
  testId?: string;
};

/** Circle avatar: custom image when set, otherwise initials from the label. */
export function IdentityAvatar({
  label,
  src = null,
  size = "md",
  className = "",
  testId = "identity-avatar",
}: IdentityAvatarProps) {
  const px = SIZE_PX[size];
  const { imageSrc, initials, label: ariaLabel } = resolveIdentityAvatar(label, src);
  const style = { width: px, height: px } satisfies CSSProperties;

  return (
    <span
      className={["inline-flex shrink-0 overflow-hidden rounded-full", className].filter(Boolean).join(" ")}
      style={style}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      data-custom-src={imageSrc ? "true" : undefined}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          width={px}
          height={px}
          className="h-full w-full border-0 object-cover"
          draggable={false}
        />
      ) : (
        <span
          className={[
            "flex h-full w-full items-center justify-center border-0",
            "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]",
            "text-caption font-semibold text-accent",
          ].join(" ")}
          data-testid={`${testId}-initials`}
        >
          {initials}
        </span>
      )}
    </span>
  );
}
