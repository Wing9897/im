import { useTranslation } from "react-i18next";
import { Badge, SelectTile, SelectTileGrid } from "../../ui";
import type { AnalysisMode, TaskTemplatePreset } from "../../../types";
import { localizeTaskPreset } from "../../../domain/tasks/localizeTaskPreset";
import { formatAnalysisTimeRange, formatAnalysisMode } from "../../../utils/analysis";
import { presetDialogTileGridColumns } from "../taskTemplatePresetDialogClasses";

type PresetGroupSectionProps = {
  title: string;
  description: string;
  presets: TaskTemplatePreset[];
  selectedPresetId: string;
  preferredAnalysisMode: AnalysisMode;
  setSelectedPresetId: (value: string) => void;
};

export function PresetGroupSection({
  title,
  description,
  presets,
  selectedPresetId,
  preferredAnalysisMode,
  setSelectedPresetId,
}: PresetGroupSectionProps) {
  const { t } = useTranslation();

  return (
    <section className="grid gap-sm">
      <div className="grid gap-px">
        <div className="text-xs font-bold text-text-primary">{title}</div>
        <div className="text-[11px] text-text-muted">{description}</div>
      </div>

      <SelectTileGrid columns={presetDialogTileGridColumns} className="gap-sm">
        {presets.map((preset) => {
          const localized = localizeTaskPreset(preset, t);
          return (
            <SelectTile
              key={preset.id}
              compact
              active={selectedPresetId === preset.id}
              onClick={() => setSelectedPresetId(preset.id)}
              className="text-left"
            >
              <div className="mb-1 flex items-start justify-between gap-1.5">
                <span className="line-clamp-2 text-xs font-semibold leading-snug text-text-primary">
                  {localized.name}
                </span>
                <Badge tone="accent" className="shrink-0">
                  {preset.badge}
                </Badge>
              </div>
              {preset.analysisMode === preferredAnalysisMode && (
                <div className="mb-1 text-left text-[10px] text-info">
                  {t("tasks.template.suitable")}
                </div>
              )}
              <div className="mb-1.5 line-clamp-2 text-[11px] leading-snug text-text-secondary">
                {localized.description}
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge tone="info">{formatAnalysisMode(preset.analysisMode)}</Badge>
                <Badge tone="success">
                  {formatAnalysisTimeRange(localized.defaultAnalysisTimeRange)}
                </Badge>
              </div>
            </SelectTile>
          );
        })}
      </SelectTileGrid>
    </section>
  );
}
