import { useTranslation } from "react-i18next";
import { RetentionCleanupPanel } from "../../components/settings/RetentionCleanupPanel";
import { RuntimeResetPanel } from "../../components/settings/RuntimeResetPanel";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog";
import { Button, FieldLabel, FormStack, TextField, formHelpClass } from "../../components/ui";
import { SettingsContentCard, SettingsFieldGroup } from "./SettingsShared";
import { useSettingsDataPage } from "./useSettingsDataPage";
import { useErrorToast } from "../../hooks/useErrorToast";

const RETENTION_ROWS = [
  { field: "retentionMessagesDays" as const, categoryKey: "data.retention.categories.messages" },
  { field: "retentionAnalysisDays" as const, categoryKey: "data.retention.categories.analysis" },
  { field: "retentionLeaderboardDays" as const, categoryKey: "data.retention.categories.leaderboard" },
  { field: "retentionAppLogsDays" as const, categoryKey: "data.retention.categories.appLogs" },
  { field: "retentionUserEventsDays" as const, categoryKey: "data.retention.categories.userEvents" },
];

export function SettingsDataPage() {
  const { t } = useTranslation("settings");
  const {
    resettingRuntimeData,
    showFullResetConfirm,
    setShowFullResetConfirm,
    showRetentionRunConfirm,
    setShowRetentionRunConfirm,
    runningRetention,
    handleConfirmRetentionRun,
    handleRequestFullReset,
    retentionValues,
    setRetentionField,
    retentionSaving,
    retentionSaved,
    retentionChanged,
    retentionError,
    handleSaveRetentionDays,
  } = useSettingsDataPage();
  useErrorToast(retentionError);

  return (
    <SettingsContentCard>
      <FormStack>
        {RETENTION_ROWS.map(({ field, categoryKey }) => {
          const categoryLabel = t(categoryKey);
          const rowLabel = t("data.retention.daysLabel", { category: categoryLabel });
          const help =
            field === "retentionAnalysisDays"
              ? t("data.retention.helpAnalysis")
              : field === "retentionAppLogsDays"
                ? t("data.retention.helpAppLogs")
                : field === "retentionUserEventsDays"
                  ? t("data.retention.helpUserEvents")
                  : undefined;
          return (
            <div key={field} className="flex w-full min-w-0 flex-col gap-sm">
              <div className="flex min-w-0 items-center gap-md">
                <FieldLabel className="min-w-0 flex-1" htmlFor={`retention-${field}`}>
                  {rowLabel}
                </FieldLabel>
                <TextField
                  id={`retention-${field}`}
                  type="number"
                  min={0}
                  step={1}
                  className="w-24 max-w-24 shrink-0"
                  value={retentionValues[field]}
                  onChange={(e) => setRetentionField(field, e.target.value)}
                  aria-label={rowLabel}
                />
                <span className="shrink-0 text-xs text-text-secondary">{t("data.retention.days")}</span>
              </div>
              {help ? <p className={formHelpClass}>{help}</p> : null}
            </div>
          );
        })}
      </FormStack>

      <div className="flex flex-wrap items-center gap-sm">
        {retentionChanged ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={retentionSaving}
            onClick={() => {
              void handleSaveRetentionDays();
            }}
          >
            {retentionSaving ? t("shared.saving") : t("data.retention.saveButton")}
          </Button>
        ) : null}
        {retentionSaved ? (
          <span className="text-xs text-success">{t("data.retention.savedCheck")}</span>
        ) : null}
      </div>
      <p className="text-xs text-text-secondary">
        {t("data.retention.description")}
      </p>

      <SettingsFieldGroup showDivider>
        <RetentionCleanupPanel
          running={runningRetention}
          onRequestConfirm={() => setShowRetentionRunConfirm(true)}
          embedded
        />
      </SettingsFieldGroup>

      <SettingsFieldGroup showDivider>
        <RuntimeResetPanel
          resettingRuntimeData={resettingRuntimeData}
          onRequestConfirm={() => setShowFullResetConfirm(true)}
          embedded
        />
      </SettingsFieldGroup>

      {showRetentionRunConfirm ? (
        <ConfirmDialog
          title={t("data.retentionRunConfirmTitle")}
          accentColor="var(--warning)"
          body={<>{t("data.retentionRunConfirmBody")}</>}
          confirmLabel={t("data.confirmCleanup")}
          confirmBusyLabel={t("shared.cleaning")}
          busy={runningRetention}
          onCancel={() => setShowRetentionRunConfirm(false)}
          onConfirm={handleConfirmRetentionRun}
        />
      ) : null}
      {showFullResetConfirm ? (
        <ConfirmDialog
          title={t("data.runtimeResetConfirmTitle")}
          accentColor="var(--error)"
          body={<>{t("data.runtimeResetConfirmBody")}</>}
          confirmLabel={t("data.confirmFullReset")}
          confirmBusyLabel={t("data.preparing")}
          busy={resettingRuntimeData}
          onCancel={() => setShowFullResetConfirm(false)}
          onConfirm={async () => {
            await handleRequestFullReset();
            setShowFullResetConfirm(false);
          }}
        />
      ) : null}
    </SettingsContentCard>
  );
}
