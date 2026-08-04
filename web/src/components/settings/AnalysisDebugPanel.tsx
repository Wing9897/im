import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ToggleSwitch";
import { CollapsePanel, FormStack, SettingsRow } from "../ui";

export interface AnalysisDebugPanelProps {
  analysisTraceVerbose: boolean;
  /** True while a persist request is in flight (disables controls). */
  busy?: boolean;
  /** Persist trace toggle immediately (switch semantics). */
  onAnalysisTraceVerboseChange: (value: boolean) => void;
  /** When true, panel starts expanded (e.g. after navigating with a focus hint). */
  defaultOpen?: boolean;
}

/** System-settings debug control for message-batch analysis trace logging. */
export function AnalysisDebugPanel({
  analysisTraceVerbose,
  busy = false,
  onAnalysisTraceVerboseChange,
  defaultOpen = false,
}: AnalysisDebugPanelProps) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(defaultOpen);

  return (
    <CollapsePanel
      title={t("general.debug.sectionTitle")}
      open={open}
      onToggle={() => setOpen((value) => !value)}
    >
      <FormStack>
        <SettingsRow
          label={t("general.debug.traceVerboseLabel")}
          help={t("general.debug.traceVerboseHelp")}
        >
          <div className="flex items-center gap-md">
            <ToggleSwitch
              checked={analysisTraceVerbose}
              disabled={busy}
              showLabel={false}
              label={t("general.debug.traceVerboseLabel")}
              onChange={onAnalysisTraceVerboseChange}
            />
            <span className="select-none text-body text-text-primary" aria-hidden="true">
              {analysisTraceVerbose ? t("shared.enabled") : t("shared.disabled")}
            </span>
          </div>
        </SettingsRow>
      </FormStack>
    </CollapsePanel>
  );
}
