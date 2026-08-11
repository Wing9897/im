import { useTranslation } from "react-i18next";
import { AdvancedSettingsPanel } from "../../components/settings/AdvancedSettingsPanel";
import { AnalysisSchedulingFields } from "../../components/settings/AnalysisSchedulingFields";
import { LoadingSpinner } from "../../components/common/LoadingSpinner";
import { SettingsSaveBar } from "../../components/settings/SettingsSaveBar";
import { CheckboxField, FormStack, SettingsRow } from "../../components/ui";
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
  const {
    settingsObject,
    settingsInitialLoading,
    error: settingsLoadError,
    saving,
    saveSuccess,
    handleSettingChange,
    handleSave,
    evidenceStyle,
  } = useSettingsAnalysisStrategyPage();

  if (settingsInitialLoading) {
    return <LoadingSpinner text={t("analysis.loading")} />;
  }

  if (!settingsObject) {
    return (
      <LoadingSpinner text={settingsLoadError ?? t("analysis.loadError")} />
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

        <SettingsRow
          label={t("analysis.autoPauseLabel")}
          help={t("analysis.autoPauseHelp")}
        >
          <CheckboxField
            label={settingsObject.autoPauseOnRetriesExhausted ? t("shared.enabled") : t("shared.disabled")}
            checked={settingsObject.autoPauseOnRetriesExhausted}
            onChange={(e) =>
              handleSettingChange("autoPauseOnRetriesExhausted", e.target.checked)
            }
            aria-label={t("analysis.autoPauseAria")}
          />
        </SettingsRow>
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
