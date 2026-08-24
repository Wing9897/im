import type { ReactNode } from "react";
import { MenuSelect, SurfaceCard } from "../../components/ui";

export function VoicePrefCard({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard
      material="panel"
      density="compact"
      role="region"
      aria-label={title}
      data-testid={testId}
    >
      {children}
    </SurfaceCard>
  );
}

const VOICE_SELECT_WRAP = "w-[16rem] max-w-full shrink-0";

export function VoiceSelectWrap({ children }: { children: ReactNode }) {
  return <div className={VOICE_SELECT_WRAP}>{children}</div>;
}

export type VoiceChoice = { id: string; label: string; available?: boolean };

export function VoiceProviderMenuSelect({
  id,
  value,
  options,
  onChange,
  testId,
  ariaLabel,
}: {
  id: string;
  value: string;
  options: readonly VoiceChoice[];
  onChange: (value: string) => void;
  testId?: string;
  ariaLabel: string;
}) {
  return (
    <VoiceSelectWrap>
      <MenuSelect
        id={id}
        variant="field"
        menuPortal
        value={value}
        options={options.map((opt) => ({
          value: opt.id,
          label: opt.label,
          disabled: opt.available === false,
        }))}
        onChange={(next) => {
          const opt = options.find((o) => o.id === next);
          if (opt?.available === false) return;
          onChange(next);
        }}
        data-testid={testId}
        aria-label={ariaLabel}
      />
    </VoiceSelectWrap>
  );
}
