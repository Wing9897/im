/**
 * Single source of truth for status indicator dots and connection-status
 * labels (dot styles, per-status colors, localized labels via i18n).
 */

import type React from "react";
import type { ConnectionStatus } from "../types";
import i18n from "../i18n";

/** Shared 8px status indicator dot driven by an explicit color token. */
export function colorStatusDotStyle(color: string): React.CSSProperties {
  return {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: color,
    display: "inline-block",
    flexShrink: 0,
  };
}

/** Inline styles for a connection-status indicator dot. */
export const statusDotStyle = (
  status: ConnectionStatus | null | undefined,
): React.CSSProperties => ({
  ...colorStatusDotStyle(
    status === "connected"
      ? "var(--success)"
      : status === "error"
        ? "var(--error)"
        : "var(--text-muted)",
  ),
  marginRight: 6,
});

/** Localized labels for each connection status (used by tests / sync snapshot). */
export const statusLabels: Record<ConnectionStatus, string> = {
  get connected() {
    return String(i18n.t("sources:connectionStatus.connected"));
  },
  get connecting() {
    return String(i18n.t("sources:telegramFields.connecting"));
  },
  get disconnected() {
    return String(i18n.t("sources:connectionStatus.disconnected"));
  },
  get error() {
    return String(i18n.t("sources:connectionStatus.error"));
  },
};

/** Safe status label lookup — never throws; unknown values fall back to disconnected. */
export function formatStatusLabel(status: string | null | undefined): string {
  if (status === "connecting") {
    return String(i18n.t("sources:telegramFields.connecting"));
  }
  if (status === "connected" || status === "disconnected" || status === "error") {
    return String(i18n.t(`sources:connectionStatus.${status}`));
  }
  return String(i18n.t("sources:connectionStatus.disconnected"));
}
