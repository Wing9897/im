import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleSwitch } from "../ToggleSwitch";
import { CollapsePanel, FormStack, SettingsRow, TextField } from "../ui";

export interface AnalysisDebugPanelProps {
  intelligenceRulesVersion: string;
  analysisTraceVerbose: boolean;
  /** True while a persist request is in flight (disables controls). */
  busy?: boolean;
  onIntelligenceRulesVersionChange: (value: string) => void;
  /** Persist rules version when the field loses focus (or Enter). */
  onIntelligenceRulesVersionCommit: (value: string) => void;
  /** Persist trace toggle immediately (switch semantics). */
  onAnalysisTraceVerboseChange: (value: boolean) => void;
  /** When true, panel starts expanded (e.g. after navigating with a focus hint). */
  defaultOpen?: boolean;
}

/** System-settings debug controls for analysis prompt tagging + server trace logging. */
export function AnalysisDebugPanel({
  intelligenceRulesVersion,
  analysisTraceVerbose,
  busy = false,
  onIntelligenceRulesVersionChange,
  onIntelligenceRulesVersionCommit,
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
            disabled={busy}
            onChange={(e) => onIntelligenceRulesVersionChange(e.target.value)}
            onBlur={() => onIntelligenceRulesVersionCommit(intelligenceRulesVersion)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder={t("general.debug.rulesVersionPlaceholder")}
            className="max-w-[200px]"
            aria-label={t("general.debug.rulesVersionLabel")}
          />
        </SettingsRow>

        <SettingsRow
          label={t("general.debug.traceVerboseLabel")}
          help={t("general.debug.traceVerboseHelp")}
        >
          <ToggleSwitch
            checked={analysisTraceVerbose}
            disabled={busy}
            showLabel={false}
            label={t("general.debug.traceVerboseLabel")}
            onChange={onAnalysisTraceVerboseChange}
          />
        </SettingsRow>
      </FormStack>
    </CollapsePanel>
  );
}
