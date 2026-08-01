import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertBanner, CheckboxField, CollapsePanel, FormStack, SettingsRow, TextField } from "../ui";

interface AdvancedSettingsPanelProps {
  analysisMaxTotalChars: string;
  analysisMaxEstimatedInputTokens: string;
  analysisTraceVerbose: boolean;
  llmGenerationTimeout: string;
  maxConcurrentBatches: string;
  maxBatchRetries: string;
  llmProvider: string;
  intelligenceRulesVersion: string;
  onAnalysisMaxTotalCharsChange: (v: string) => void;
  onAnalysisMaxEstimatedInputTokensChange: (v: string) => void;
  onAnalysisTraceVerboseChange: (v: boolean) => void;
  onLlmGenerationTimeoutChange: (v: string) => void;
  onMaxConcurrentBatchesChange: (v: string) => void;
  onMaxBatchRetriesChange: (v: string) => void;
  onIntelligenceRulesVersionChange: (v: string) => void;
}

export function AdvancedSettingsPanel({
  analysisMaxTotalChars,
  analysisMaxEstimatedInputTokens,
  analysisTraceVerbose,
  llmGenerationTimeout,
  maxConcurrentBatches,
  maxBatchRetries,
  llmProvider,
  intelligenceRulesVersion,
  onAnalysisMaxTotalCharsChange,
  onAnalysisMaxEstimatedInputTokensChange,
  onAnalysisTraceVerboseChange,
  onLlmGenerationTimeoutChange,
  onMaxConcurrentBatchesChange,
  onMaxBatchRetriesChange,
  onIntelligenceRulesVersionChange,
}: AdvancedSettingsPanelProps) {
  const { t } = useTranslation("settings");
  const [batchOpen, setBatchOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  const concurrentNum = parseInt(maxConcurrentBatches, 10);

  return (
    <FormStack gap="lg">
      <CollapsePanel
        title={t("analysis.advanced.batchSectionTitle")}
        open={batchOpen}
        onToggle={() => setBatchOpen((v) => !v)}
      >
        <SettingsRow
          label={t("analysis.advanced.timeoutLabel")}
          htmlFor="llm-generation-timeout"
          help={t("analysis.advanced.timeoutHelp")}
        >
          <TextField
            id="llm-generation-timeout"
            type="number"
            min={30}
            max={1800}
            className="max-w-[200px]"
            value={llmGenerationTimeout}
            onChange={(e) => onLlmGenerationTimeoutChange(e.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t("analysis.advanced.maxRetriesLabel")}
          htmlFor="max-batch-retries"
          help={t("analysis.advanced.maxRetriesHelp")}
        >
          <TextField
            id="max-batch-retries"
            type="number"
            min={1}
            max={10}
            className="max-w-[200px]"
            value={maxBatchRetries}
            onChange={(e) => onMaxBatchRetriesChange(e.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t("analysis.advanced.maxConcurrentLabel")}
          htmlFor="max-concurrent-batches"
          help={
            llmProvider === "ollama"
              ? t("analysis.advanced.maxConcurrentHelpOllama")
              : t("analysis.advanced.maxConcurrentHelpCloud")
          }
        >
          <TextField
            id="max-concurrent-batches"
            type="number"
            min={1}
            max={10}
            className="max-w-[200px]"
            value={maxConcurrentBatches}
            onChange={(e) => onMaxConcurrentBatchesChange(e.target.value)}
          />
          {concurrentNum > 1 ? (
            <AlertBanner variant="warning" className="mt-sm mb-0 text-caption">
              {t("analysis.advanced.maxConcurrentWarning")}
            </AlertBanner>
          ) : null}
          {concurrentNum > 2 && llmProvider === "ollama" ? (
            <AlertBanner variant="error" className="mt-sm mb-0 text-caption">
              {t("analysis.advanced.maxConcurrentError")}
            </AlertBanner>
          ) : null}
        </SettingsRow>
      </CollapsePanel>

      <CollapsePanel
        title={t("analysis.advanced.limitsSectionTitle")}
        open={limitsOpen}
        onToggle={() => setLimitsOpen((v) => !v)}
      >
        <SettingsRow
          label={t("analysis.advanced.maxCharsLabel")}
          htmlFor="analysis-max-total-chars"
          help={t("analysis.advanced.maxCharsHelp")}
        >
          <TextField
            id="analysis-max-total-chars"
            type="number"
            min={1000}
            step={1000}
            className="max-w-[200px]"
            value={analysisMaxTotalChars}
            onChange={(e) => onAnalysisMaxTotalCharsChange(e.target.value)}
          />
        </SettingsRow>

        <SettingsRow
          label={t("analysis.advanced.maxTokensLabel")}
          htmlFor="analysis-max-estimated-input-tokens"
          help={t("analysis.advanced.maxTokensHelp")}
        >
          <TextField
            id="analysis-max-estimated-input-tokens"
            type="number"
            min={1000}
            step={1000}
            className="max-w-[200px]"
            value={analysisMaxEstimatedInputTokens}
            onChange={(e) => onAnalysisMaxEstimatedInputTokensChange(e.target.value)}
          />
        </SettingsRow>
      </CollapsePanel>

      <CollapsePanel
        title={t("analysis.advanced.debugSectionTitle")}
        open={promptOpen}
        onToggle={() => setPromptOpen((v) => !v)}
      >
        <SettingsRow
          label={t("analysis.advanced.rulesVersionLabel")}
          htmlFor="intelligence-rules-version"
          help={t("analysis.advanced.rulesVersionHelp")}
        >
          <TextField
            id="intelligence-rules-version"
            value={intelligenceRulesVersion}
            onChange={(e) => onIntelligenceRulesVersionChange(e.target.value)}
            placeholder="v2"
            className="max-w-[200px]"
          />
        </SettingsRow>

        <SettingsRow
          label={t("analysis.advanced.traceVerboseLabel")}
          help={t("analysis.advanced.traceVerboseHelp")}
        >
          <CheckboxField
            id="analysis-trace-verbose"
            label={analysisTraceVerbose ? t("shared.enabled") : t("shared.disabled")}
            checked={analysisTraceVerbose}
            onChange={(e) => onAnalysisTraceVerboseChange(e.target.checked)}
            aria-label={t("analysis.advanced.traceVerboseLabel")}
          />
        </SettingsRow>
      </CollapsePanel>
    </FormStack>
  );
}
