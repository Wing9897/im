import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdvancedSettingsPanel } from "../../components/settings/AdvancedSettingsPanel";
import { AnalysisSchedulingFields } from "../../components/settings/AnalysisSchedulingFields";
import { ErrorRetryBanner } from "../../components/common/ErrorRetryBanner";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { SettingsSaveBar } from "../../components/settings/SettingsSaveBar";
import { SelectTile, FormStack } from "../../components/ui";
import {
  getEvidenceStyleOptions,
  type EvidenceStyle,
} from "../../domain/settings/analysisEvidenceStyle";
import {
  SettingsContentCard,
  SettingsFieldGroup,
} from "../../components/settings/SettingsFormLayout";
import { useSettingsAnalysisStrategyPage } from "./useSettingsAnalysisStrategyPage";

export function SettingsAnalysisStrategyPage() {
  const { t } = useTranslation("settings");
  const [isRetrying, setIsRetrying] = useState(false);
  const {
    settingsObject,
    settingsInitialLoading,
    error: settingsLoadError,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave,
    reloadSettings,
    evidenceStyle,
  } = useSettingsAnalysisStrategyPage();

  if (settingsInitialLoading) {
    return <LoadingSpinner text={t("analysis.loading")} />;
  }

  if (!settingsObject) {
    return (
      <ErrorRetryBanner
        error={settingsLoadError ?? t("analysis.loadError")}
        retrying={isRetrying}
        onRetry={() => {
          setIsRetrying(true);
          void reloadSettings().finally(() => setIsRetrying(false));
        }}
      />
    );
  }

  const evidenceStyleOptions = getEvidenceStyleOptions(t);
  const evidenceHelp =
    evidenceStyleOptions.find((o) => o.value === evidenceStyle)?.description ?? "";

  return (
    <SettingsContentCard>
      <FormStack>
        <AnalysisSchedulingFields
          idPrefix="analysis"
          triggerThreshold={settingsObject.analysisTriggerThreshold}
          batchLimit={settingsObject.analysisBatchMessageLimit}
          evidenceStyle={evidenceStyle}
          onTriggerThresholdChange={(v) =>
            handleSettingChange("analysisTriggerThreshold", v)
          }
          onBatchLimitChange={(v) =>
            handleSettingChange("analysisBatchMessageLimit", v)
          }
          onEvidenceStyleChange={(v) =>
            handleSettingChange("analysisStrategyMode", v as EvidenceStyle)
          }
          labels={{
            triggerThreshold: t("analysis.triggerThresholdLabel"),
            triggerThresholdHelp: t("analysis.triggerThresholdHelp"),
            batchLimit: t("analysis.batchLimitLabel"),
            batchLimitHelp: t("analysis.batchLimitHelp"),
            evidenceStyle: t("analysis.evidenceStyleLabel"),
            evidenceStyleHelp: `${evidenceHelp} ${t("analysis.evidenceStyleHelpSuffix")}`,
          }}
        />

        <SelectTile
          compact
          variant="toggle"
          className="max-w-[320px]"
          active={settingsObject.autoPauseOnRetriesExhausted}
          data-testid="analysis-auto-pause"
          aria-label={t("analysis.autoPauseAria")}
          title={t("analysis.autoPauseHelp")}
          hint={t("analysis.autoPauseHelp")}
          onClick={() =>
            handleSettingChange(
              "autoPauseOnRetriesExhausted",
              !settingsObject.autoPauseOnRetriesExhausted,
            )
          }
        >
          {t("analysis.autoPauseLabel")}
        </SelectTile>
      </FormStack>

      <SettingsFieldGroup showDivider>
        <AdvancedSettingsPanel
          analysisMaxTotalChars={settingsObject.analysisMaxTotalChars}
          analysisMaxEstimatedInputTokens={settingsObject.analysisMaxEstimatedInputTokens}
          llmGenerationTimeout={settingsObject.llmGenerationTimeout}
          maxConcurrentBatches={settingsObject.maxConcurrentBatches}
          maxBatchRetries={settingsObject.maxBatchRetries}
          onAnalysisMaxTotalCharsChange={(v) => handleSettingChange("analysisMaxTotalChars", v)}
          onAnalysisMaxEstimatedInputTokensChange={(v) =>
            handleSettingChange("analysisMaxEstimatedInputTokens", v)
          }
          onLlmGenerationTimeoutChange={(v) => handleSettingChange("llmGenerationTimeout", v)}
          onMaxConcurrentBatchesChange={(v) => handleSettingChange("maxConcurrentBatches", v)}
          onMaxBatchRetriesChange={(v) => handleSettingChange("maxBatchRetries", v)}
        />
      </SettingsFieldGroup>

      <SettingsSaveBar
        saving={saving}
        saveSuccess={saveSuccess}
        saveLabel={t("analysis.saveLabel")}
        onSave={handleSave}
      />
    </SettingsContentCard>
  );
}
