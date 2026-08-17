import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ToggleSwitch";
import { CollapsePanel, FieldLabel, formHelpClass } from "../ui";

export interface AnalysisDebugPanelProps {
  analysisTraceVerbose: boolean;
  /** True while a persist request is in flight (disables controls). */
  busy?: boolean;
  /** Persist trace toggle immediately (switch semantics). */
  onAnalysisTraceVerboseChange: (value: boolean) => void;
  /** When true, panel starts expanded (e.g. after navigating with a focus hint). */
  defaultOpen?: boolean;
  /**
   * When true, render controls without the local CollapsePanel
   * (e.g. already nested under Settings → General advanced).
   */
  embedded?: boolean;
}

/** System-settings debug control for message-batch analysis trace logging. */
export function AnalysisDebugPanel({
  analysisTraceVerbose,
  busy = false,
  onAnalysisTraceVerboseChange,
  defaultOpen = false,
  embedded = false,
}: AnalysisDebugPanelProps) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(defaultOpen);

  const controls = (
    <div className="flex min-w-0 flex-col gap-xs" title={t("general.debug.traceVerboseHelp")}>
      <div className="flex min-w-0 items-center gap-md">
        <FieldLabel className="mb-0 min-w-0 flex-1">
          {t("general.debug.traceVerboseLabel")}
        </FieldLabel>
        <ToggleSwitch
          checked={analysisTraceVerbose}
          disabled={busy}
          onChange={onAnalysisTraceVerboseChange}
          label={t("general.debug.traceVerboseLabel")}
          showLabel={false}
          data-testid="analysis-trace-verbose"
        />
      </div>
      <p className={formHelpClass}>{t("general.debug.traceVerboseHint")}</p>
    </div>
  );

  if (embedded) {
    return (
      <div data-testid="analysis-debug-panel">
        <div className="mb-sm text-caption font-semibold leading-snug text-text-primary">
          {t("general.debug.sectionTitle")}
        </div>
        {controls}
      </div>
    );
  }

  return (
    <CollapsePanel
      title={t("general.debug.sectionTitle")}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      {controls}
    </CollapsePanel>
  );
}
