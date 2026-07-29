import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { InfoTooltip } from "../../components/common/InfoTooltip";
import {
  Button,
  CheckboxField,
  FilterChip,
  PanelSection,
  SelectField,
  formHelpClass,
} from "../../components/ui";
import {
  PREAMBLE_CHIME_IDS,
  type PreambleChimeId,
} from "../../voiceReminder/preambleChime";
import { LEAD_OFFSET_OPTIONS } from "../../voiceReminder/settings";
import { useVoiceReminderPanelState } from "./useVoiceReminderPanelState";
import { VoiceReminderSourcesSection } from "./VoiceReminderSourcesSection";

/**
 * Local voice reminders for timed 關鍵事件、循環任務與手動／助手事件。
 * Full-page tab under `/actions?tab=voice`.
 */
export function VoiceReminderPanel() {
  const { t } = useTranslation("actions");
  const {
    settings,
    update,
    toggleLead,
    previewing,
    handlePreview,
    tasksLoading,
    sourceTasks,
    draftTaskIds,
    draftListenAll,
    draftSelectedCount,
    taskSelectionDirty,
    toggleDraftTask,
    selectAllDraftTasks,
    clearDraftTaskFilter,
    confirmTaskSelection,
    resetDraftTaskSelection,
  } = useVoiceReminderPanelState();

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-wrap items-center gap-sm rounded-[12px] border border-[color-mix(in_srgb,var(--surface-border)_80%,transparent)] bg-[color-mix(in_srgb,var(--surface-base)_55%,transparent)] px-md py-sm">
        <p className="m-0 text-body font-medium text-text-primary">{t("voice.title")}</p>
        <InfoTooltip
          ariaLabel={t("voice.tooltipAria")}
          content={t("voice.tooltipContent", { returnObjects: true }) as string[]}
        />
        <Link
          to="/ai/voice"
          className="ml-auto shrink-0 text-caption text-accent underline-offset-2 hover:underline"
        >
          {t("voice.aiVoiceLink")}
        </Link>
      </div>

      <PanelSection title={t("voice.sectionEnable")} showCount={false}>
        <CheckboxField
          id="voice-reminder-enabled"
          label={t("voice.enableLabel")}
          help={t("voice.enableHelp")}
          checked={settings.enabled}
          onChange={(e) => update({ enabled: e.target.checked })}
        />
      </PanelSection>

      <PanelSection title={t("voice.sectionLead")} showCount={false}>
        <div className="flex flex-col gap-sm">
          <p className="m-0 text-body font-medium text-text-primary">
            {t("voice.leadLabel")}
          </p>
          <div className="flex flex-wrap gap-sm">
            {LEAD_OFFSET_OPTIONS.map((offset) => {
              const leadLabel = t(`voice.lead.${offset}`);
              return (
                <FilterChip
                  key={offset}
                  active={settings.leadOffsetsMinutes.includes(offset)}
                  onClick={() => toggleLead(offset)}
                  aria-label={t("voice.leadAria", { label: leadLabel })}
                >
                  {leadLabel}
                </FilterChip>
              );
            })}
          </div>
          <p className={`m-0 ${formHelpClass}`}>{t("voice.leadHelp")}</p>
        </div>
      </PanelSection>

      <PanelSection title={t("voice.sectionQuiet")} showCount={false}>
        <div className="flex flex-col gap-md">
          <CheckboxField
            id="voice-reminder-quiet-hours-enabled"
            label={t("voice.quietEnableLabel")}
            help={t("voice.quietEnableHelp")}
            checked={settings.quietHours.enabled}
            onChange={(e) =>
              update({
                quietHours: { ...settings.quietHours, enabled: e.target.checked },
              })
            }
          />
          <div
            className="flex flex-wrap items-end gap-md rounded-lg border border-[color-mix(in_srgb,var(--surface-border)_70%,transparent)] bg-[color-mix(in_srgb,var(--surface-base)_40%,transparent)] px-md py-sm"
            aria-disabled={!settings.quietHours.enabled}
          >
            <label className="flex min-w-[140px] flex-col gap-xs text-body text-text-secondary">
              {t("voice.quietStart")}
              <input
                className="min-h-10 rounded-md border border-surface-border bg-surface-raised px-sm text-body text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                type="time"
                value={settings.quietHours.start}
                aria-label={t("voice.quietStartAria")}
                disabled={!settings.quietHours.enabled}
                onChange={(e) =>
                  update({ quietHours: { ...settings.quietHours, start: e.target.value } })
                }
              />
            </label>
            <label className="flex min-w-[140px] flex-col gap-xs text-body text-text-secondary">
              {t("voice.quietEnd")}
              <input
                className="min-h-10 rounded-md border border-surface-border bg-surface-raised px-sm text-body text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                type="time"
                value={settings.quietHours.end}
                aria-label={t("voice.quietEndAria")}
                disabled={!settings.quietHours.enabled}
                onChange={(e) =>
                  update({ quietHours: { ...settings.quietHours, end: e.target.value } })
                }
              />
            </label>
          </div>
          <p className={`m-0 ${formHelpClass}`}>
            {t("voice.quietHelp")}
          </p>
        </div>
      </PanelSection>

      <PanelSection title={t("voice.sectionPreamble")} showCount={false}>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-sm">
            <p className="m-0 text-body font-medium text-text-primary">
              {t("voice.preambleLabel")}
            </p>
            <SelectField
              aria-label={t("voice.preambleAria")}
              className="max-w-[280px]"
              value={settings.preambleChimeId}
              onChange={(e) =>
                update({
                  preambleChimeId: e.target.value as PreambleChimeId,
                })
              }
            >
              {PREAMBLE_CHIME_IDS.map((id) => (
                <option key={id} value={id}>
                  {t(`voice.chime.${id}`)}
                </option>
              ))}
            </SelectField>
            <p className={`m-0 ${formHelpClass}`}>
              {t("voice.preambleHelp")}
            </p>
          </div>
          <div>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handlePreview}
              disabled={previewing}
              aria-label={t("voice.previewAria")}
            >
              {previewing ? t("voice.previewing") : t("voice.preview")}
            </Button>
          </div>
        </div>
      </PanelSection>

      <VoiceReminderSourcesSection
        tasksLoading={tasksLoading}
        sourceTasks={sourceTasks}
        draftTaskIds={draftTaskIds}
        draftListenAll={draftListenAll}
        draftSelectedCount={draftSelectedCount}
        taskSelectionDirty={taskSelectionDirty}
        onToggleDraftTask={toggleDraftTask}
        onSelectAll={selectAllDraftTasks}
        onClearAll={clearDraftTaskFilter}
        onConfirm={confirmTaskSelection}
        onResetDraft={resetDraftTaskSelection}
      />
    </div>
  );
}
