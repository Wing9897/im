import type React from "react";
import { FormStack, SurfaceCard } from "../ui";

interface SettingsContentCardProps {
  children?: React.ReactNode;
}

/** Compact settings form surface — no section hero titles. */
export function SettingsContentCard({ children }: SettingsContentCardProps) {
  return (
    <SurfaceCard material="solid" density="field" className="relative z-[21] isolate">
      <FormStack gap="lg">{children}</FormStack>
    </SurfaceCard>
  );
}

interface SettingsFieldGroupProps {
  children?: React.ReactNode;
  /** Visual separator between field blocks (no title row). */
  showDivider?: boolean;
}

/** Flat settings block — optional top spacing when stacked. */
export function SettingsFieldGroup({
  children,
  showDivider = false,
}: SettingsFieldGroupProps) {
  const cls = [
    "flex flex-col gap-lg",
    showDivider ? "pt-lg" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={cls}>{children}</div>;
}
