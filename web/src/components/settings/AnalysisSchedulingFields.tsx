import { MenuSelect, SettingsRow, TextField } from "../ui";
import {
  getEvidenceStyleOptions,
  type EvidenceStyle,
} from "../../domain/settings/analysisEvidenceStyle";

export type AnalysisSchedulingLabels = {
  triggerThreshold: string;
  triggerThresholdHelp: string;
  batchLimit: string;
  batchLimitHelp: string;
  evidenceStyle: string;
  evidenceStyleHelp: string;
  followGlobal?: string;
  followGlobalPlaceholder?: string;
};

export type AnalysisSchedulingFieldsProps = {
  triggerThreshold: string;
  batchLimit: string;
  /** Evidence style value, or ``""`` when ``allowFollowGlobal`` and following defaults. */
  evidenceStyle: string;
  onTriggerThresholdChange: (value: string) => void;
  onBatchLimitChange: (value: string) => void;
  onEvidenceStyleChange: (value: string) => void;
  labels: AnalysisSchedulingLabels;
  /** Empty number fields + empty evidence option mean follow global scheduling. */
  allowFollowGlobal?: boolean;
  idPrefix?: string;
};

/**
 * Shared trigger / batch-limit / evidence-style controls for global
 * scheduling settings and per-task override forms.
 */
export function AnalysisSchedulingFields({
  triggerThreshold,
  batchLimit,
  evidenceStyle,
  onTriggerThresholdChange,
  onBatchLimitChange,
  onEvidenceStyleChange,
  labels,
  allowFollowGlobal = false,
  idPrefix = "analysis",
}: AnalysisSchedulingFieldsProps) {
  const evidenceOptions = getEvidenceStyleOptions();
  const triggerId = `${idPrefix}-trigger-threshold`;
  const batchId = `${idPrefix}-batch-message-limit`;
  const evidenceId = `${idPrefix}-evidence-style`;

  return (
    <>
      <SettingsRow
        label={labels.triggerThreshold}
        htmlFor={triggerId}
        help={labels.triggerThresholdHelp}
      >
        <TextField
          id={triggerId}
          type="number"
          min={1}
          max={500}
          step={1}
          className="max-w-[200px]"
          value={triggerThreshold}
          placeholder={
            allowFollowGlobal ? labels.followGlobalPlaceholder : undefined
          }
          onChange={(e) => onTriggerThresholdChange(e.target.value)}
          aria-label={labels.triggerThreshold}
        />
      </SettingsRow>

      <SettingsRow
        label={labels.batchLimit}
        htmlFor={batchId}
        help={labels.batchLimitHelp}
      >
        <TextField
          id={batchId}
          type="number"
          min={1}
          max={500}
          step={1}
          className="max-w-[200px]"
          value={batchLimit}
          placeholder={
            allowFollowGlobal ? labels.followGlobalPlaceholder : undefined
          }
          onChange={(e) => onBatchLimitChange(e.target.value)}
          aria-label={labels.batchLimit}
        />
      </SettingsRow>

      <SettingsRow
        label={labels.evidenceStyle}
        htmlFor={evidenceId}
        help={labels.evidenceStyleHelp}
      >
        <MenuSelect
          id={evidenceId}
          variant="field"
          className="max-w-[320px]"
          value={evidenceStyle}
          options={[
            ...(allowFollowGlobal && labels.followGlobal
              ? [{ value: "", label: labels.followGlobal }]
              : []),
            ...evidenceOptions.map((opt) => ({
              value: opt.value,
              label: opt.label,
            })),
          ]}
          onChange={onEvidenceStyleChange}
          aria-label={labels.evidenceStyle}
        />
      </SettingsRow>
    </>
  );
}

export function optionalNumberToInput(value: number | null): string {
  return value == null ? "" : String(value);
}

export function parseOptionalPositiveInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isInteger(num) || num < 1) return null;
  return num;
}

export type { EvidenceStyle };
