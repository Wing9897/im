export interface EmptyStateIllustrationProps {
  /** Maximum width in pixels, default 200 */
  maxWidth?: number;
  /** Maximum height in pixels, default 160 */
  maxHeight?: number;
  /** aria-label for accessibility; when omitted, illustration is marked aria-hidden */
  ariaLabel?: string;
}

/**
 * Empty state illustration for the intelligence feed (no intelligence items).
 * Renders a radar/monitoring concept using theme CSS custom properties.
 */
export function EmptyStateIntelligence({
  maxWidth = 200,
  maxHeight = 160,
  ariaLabel,
}: EmptyStateIllustrationProps) {
  return (
    <svg
      width="100%"
      viewBox="0 0 200 160"
      fill="none"
      style={{ maxWidth, maxHeight, height: "auto", display: "block", margin: "0 auto" }}
      aria-hidden={!ariaLabel ? "true" : undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {/* Radar base circle */}
      <circle cx="100" cy="80" r="50" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
      {/* Radar inner rings */}
      <circle cx="100" cy="80" r="34" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" opacity="0.6" />
      <circle cx="100" cy="80" r="18" stroke="var(--text-muted)" strokeWidth="1" fill="none" opacity="0.4" />
      {/* Radar crosshairs */}
      <line x1="100" y1="30" x2="100" y2="130" stroke="var(--text-muted)" strokeWidth="1" opacity="0.3" />
      <line x1="50" y1="80" x2="150" y2="80" stroke="var(--text-muted)" strokeWidth="1" opacity="0.3" />
      {/* Radar sweep line */}
      <line x1="100" y1="80" x2="135" y2="50" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      {/* Radar center dot */}
      <circle cx="100" cy="80" r="4" fill="var(--accent)" />
      {/* Signal blips */}
      <circle cx="82" cy="65" r="3" fill="var(--accent)" opacity="0.6" />
      <circle cx="120" cy="95" r="2.5" fill="var(--accent)" opacity="0.4" />
      <circle cx="110" cy="60" r="2" fill="var(--accent)" opacity="0.3" />
      {/* Decorative signal waves (top right) */}
      <path d="M150 35 Q155 30 160 35" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" opacity="0.4" strokeLinecap="round" />
      <path d="M148 28 Q155 22 162 28" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" opacity="0.3" strokeLinecap="round" />
      {/* Decorative dots */}
      <circle cx="40" cy="45" r="2" fill="var(--text-muted)" opacity="0.3" />
      <circle cx="165" cy="120" r="3" fill="var(--accent)" opacity="0.2" />
    </svg>
  );
}

/**
 * Empty state illustration for the sources page (no sources configured).
 * Renders a network/connection hub concept using theme CSS custom properties.
 */
export function EmptyStateSources({
  maxWidth = 200,
  maxHeight = 160,
  ariaLabel,
}: EmptyStateIllustrationProps) {
  return (
    <svg
      width="100%"
      viewBox="0 0 200 160"
      fill="none"
      style={{ maxWidth, maxHeight, height: "auto", display: "block", margin: "0 auto" }}
      aria-hidden={!ariaLabel ? "true" : undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {/* Central hub node */}
      <circle cx="100" cy="80" r="14" stroke="var(--accent)" strokeWidth="2" fill="none" />
      <circle cx="100" cy="80" r="5" fill="var(--accent)" />
      {/* Top node */}
      <circle cx="100" cy="30" r="10" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
      <line x1="100" y1="40" x2="100" y2="66" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Right node */}
      <circle cx="155" cy="95" r="10" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
      <line x1="145" y1="90" x2="114" y2="82" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Left node */}
      <circle cx="45" cy="95" r="10" stroke="var(--text-muted)" strokeWidth="2" fill="none" />
      <line x1="55" y1="90" x2="86" y2="82" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* Bottom-left node */}
      <circle cx="60" cy="135" r="8" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" opacity="0.6" />
      <line x1="66" y1="128" x2="92" y2="92" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      {/* Bottom-right node */}
      <circle cx="140" cy="135" r="8" stroke="var(--text-muted)" strokeWidth="1.5" fill="none" opacity="0.6" />
      <line x1="134" y1="128" x2="108" y2="92" stroke="var(--text-muted)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
      {/* Plus icon inside top node */}
      <line x1="96" y1="30" x2="104" y2="30" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="100" y1="26" x2="100" y2="34" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Small fills inside outer nodes */}
      <circle cx="155" cy="95" r="3" fill="var(--text-muted)" opacity="0.4" />
      <circle cx="45" cy="95" r="3" fill="var(--text-muted)" opacity="0.4" />
      {/* Decorative signal dots */}
      <circle cx="30" cy="50" r="2" fill="var(--accent)" opacity="0.3" />
      <circle cx="170" cy="55" r="2.5" fill="var(--accent)" opacity="0.2" />
      <circle cx="175" cy="130" r="2" fill="var(--text-muted)" opacity="0.3" />
    </svg>
  );
}

/** Named illustrations used by EmptyState `illustrationKey`. */
export const EMPTY_STATE_ILLUSTRATIONS = {
  intelligence: EmptyStateIntelligence,
  sources: EmptyStateSources,
} as const;

export type EmptyStateIllustrationKey = keyof typeof EMPTY_STATE_ILLUSTRATIONS;
