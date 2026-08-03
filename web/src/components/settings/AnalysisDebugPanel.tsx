import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckboxField, CollapsePanel, FormStack, SettingsRow, TextField } from "../ui";

export interface AnalysisDebugPanelProps {
  intelligenceRulesVersion: string;
  analysisTraceVerbose: boolean;
  onIntelligenceRulesVersionChange: (value: string) => void;
  onAnalysisTraceVerboseChange: (value: boolean) => void;
  /** When true, panel starts expanded (e.g. after navigating with a focus hint). */
  defaultOpen?: boolean;
}

/** System-settings debug controls for analysis prompt tagging + server trace logging. */
export function AnalysisDebugPanel({
  intelligenceRulesVersion,
  analysisTraceVerbose,
  onIntelligenceRulesVersionChange,
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
          label={t("general.debug.rulesVersionLabel")}
          htmlFor="intelligence-rules-version"
          help={t("general.debug.rulesVersionHelp")}
        >
          <TextField
            id="intelligence-rules-version"
            value={intelligenceRulesVersion}
            onChange={(e) => onIntelligenceRulesVersionChange(e.target.value)}
            placeholder={t("general.debug.rulesVersionPlaceholder")}
            className="max-w-[200px]"
            aria-label={t("general.debug.rulesVersionLabel")}
          />
        </SettingsRow>

        <SettingsRow
          label={t("general.debug.traceVerboseLabel")}
          help={t("general.debug.traceVerboseHelp")}
        >
          <CheckboxField
            id="analysis-trace-verbose"
            label={analysisTraceVerbose ? t("shared.enabled") : t("shared.disabled")}
            checked={analysisTraceVerbose}
            onChange={(e) => onAnalysisTraceVerboseChange(e.target.checked)}
            aria-label={t("general.debug.traceVerboseLabel")}
          />
        </SettingsRow>
      </FormStack>
    </CollapsePanel>
  );
}
