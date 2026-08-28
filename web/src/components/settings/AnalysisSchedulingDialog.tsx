import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ModalDialog } from "../ModalDialog";
import { AdvancedSettingsPanel } from "./AdvancedSettingsPanel";
import { AnalysisSchedulingFields } from "./AnalysisSchedulingFields";
import { ErrorRetryBanner } from "../common/ErrorRetryBanner";
import { LoadingSpinner } from "../common/LoadingSpinner";
import { ConfirmDialog } from "../dialogs/ConfirmDialog";
import { Button, FormActions, FormStack, SelectTile } from "../ui";
import { SettingsFieldGroup } from "./SettingsFormLayout";
import {
  getEvidenceStyleOptions,
  type EvidenceStyle,
} from "../../domain/settings/analysisEvidenceStyle";
import { useAnalysisSchedulingForm } from "./useAnalysisSchedulingForm";

export function AnalysisSchedulingDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(["settings", "tasks", "common"]);
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
    settings,
    savedSnapshot,
    showConcurrentBatchesWarning,
    confirmConcurrentBatchesSave,
    cancelConcurrentBatchesSave,
  } = useAnalysisSchedulingForm();

  const evidenceStyleOptions = getEvidenceStyleOptions(t);
  const evidenceHelp =
    evidenceStyleOptions.find((o) => o.value === evidenceStyle)?.description ?? "";

  let body;
  if (settingsInitialLoading) {
    body = <LoadingSpinner text={t("settings:analysis.loading")} />;
  } else if (!settingsObject) {
    body = (
      <ErrorRetryBanner
        error={settingsLoadError ?? t("settings:analysis.loadError")}
        retrying={isRetrying}
        onRetry={() => {
          setIsRetrying(true);
          void reloadSettings().finally(() => setIsRetrying(false));
        }}
      />
    );
  } else {
    body = (
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
            triggerThreshold: t("settings:analysis.triggerThresholdLabel"),
            triggerThresholdHelp: t("settings:analysis.triggerThresholdHelp"),
            batchLimit: t("settings:analysis.batchLimitLabel"),
            batchLimitHelp: t("settings:analysis.batchLimitHelp"),
            evidenceStyle: t("settings:analysis.evidenceStyleLabel"),
            evidenceStyleHelp: `${evidenceHelp} ${t("settings:analysis.evidenceStyleHelpSuffix")}`,
          }}
        />

        <SelectTile
          compact
          variant="toggle"
          className="max-w-[320px]"
          active={settingsObject.autoPauseOnRetriesExhausted}
          data-testid="analysis-auto-pause"
          aria-label={t("settings:analysis.autoPauseAria")}
          title={t("settings:analysis.autoPauseHelp")}
          hint={t("settings:analysis.autoPauseHelp")}
          onClick={() =>
            handleSettingChange(
              "autoPauseOnRetriesExhausted",
              !settingsObject.autoPauseOnRetriesExhausted,
            )
          }
        >
          {t("settings:analysis.autoPauseLabel")}
        </SelectTile>

        <SettingsFieldGroup showDivider>
          <AdvancedSettingsPanel
            analysisMaxTotalChars={settingsObject.analysisMaxTotalChars}
            analysisMaxEstimatedInputTokens={settingsObject.analysisMaxEstimatedInputTokens}
            maxConcurrentBatches={settingsObject.maxConcurrentBatches}
            maxBatchRetries={settingsObject.maxBatchRetries}
            onAnalysisMaxTotalCharsChange={(v) =>
              handleSettingChange("analysisMaxTotalChars", v)
            }
            onAnalysisMaxEstimatedInputTokensChange={(v) =>
              handleSettingChange("analysisMaxEstimatedInputTokens", v)
            }
            onMaxConcurrentBatchesChange={(v) =>
              handleSettingChange("maxConcurrentBatches", v)
            }
            onMaxBatchRetriesChange={(v) => handleSettingChange("maxBatchRetries", v)}
          />
        </SettingsFieldGroup>
      </FormStack>
    );
  }

  return (
    <>
      <ModalDialog
        open={open}
        size="form"
        title={t("tasks:globalSchedulingSettings")}
        onClose={onClose}
        testId="global-scheduling-dialog"
        footer={
          <FormActions inline>
            {saveSuccess ? (
              <span className="text-xs font-medium text-success">
                {t("settings:shared.saveSuccess")}
              </span>
            ) : null}
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              {t("common:dialog.cancel")}
            </Button>
            <Button
              variant="primary"
              disabled={saving || !settingsObject}
              onClick={() => void handleSave().catch(() => {})}
            >
              {saving ? t("settings:shared.saving") : t("settings:analysis.saveLabel")}
            </Button>
          </FormActions>
        }
      >
        {body}
      </ModalDialog>

      {showConcurrentBatchesWarning && settings && savedSnapshot ? (
        <ConfirmDialog
          title={t("settings:concurrentBatchesConfirm.title")}
          accentColor="var(--warning)"
          confirmLabel={t("settings:concurrentBatchesConfirm.confirmLabel")}
          confirmBusyLabel={t("settings:shared.saving")}
          busy={saving}
          onConfirm={confirmConcurrentBatchesSave}
          onCancel={cancelConcurrentBatchesSave}
          body={
            <>
              <p className="mb-sm mt-0">
                <Trans
                  i18nKey="settings:concurrentBatchesConfirm.bodyChange"
                  values={{
                    from: savedSnapshot.maxConcurrentBatches,
                    to: settings.maxConcurrentBatches,
                  }}
                  components={{ strong: <strong /> }}
                />
              </p>
              <p className="mb-xs mt-0">
                {t("settings:concurrentBatchesConfirm.bodyCostWarning")}
              </p>
              <p className="m-0">{t("settings:concurrentBatchesConfirm.bodyLocalWarning")}</p>
            </>
          }
        />
      ) : null}
    </>
  );
}
