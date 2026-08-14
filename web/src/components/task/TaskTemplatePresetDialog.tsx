import React from "react";
import { useTranslation } from "react-i18next";

import type { AnalysisMode, TaskTemplatePreset } from "../../types";
import { ModalDialog } from "../ModalDialog";
import { Button } from "../ui";
import { formatAnalysisMode } from "../../utils/analysis";
import { localizeTaskPreset } from "../../domain/tasks/localizeTaskPreset";
import type { TemplateUsageMap } from "./taskTemplateTypes";
import { getTaskFormAnalysisModeMeta, taskFormAnalysisModeOrder } from "./taskFormAnalysisModeMeta";
import { analysisModeSupportsTaskPresets } from "../../domain/tasks/taskPresetModes";
import { FilterChip } from "../ui";
import { PresetGroupSection } from "./TaskTemplatePresetDialog/PresetGroupSection";
import { StateMessage } from "./TaskTemplatePresetDialog/StateMessage";
import {
  presetDialogContainerClass,
  presetDialogFilterChipRowClass,
  presetDialogFilterGridClass,
  presetDialogGroupGridClass,
  presetDialogScrollableClass,
  presetDialogSearchGridClass,
  presetDialogSearchInputClass,
} from "./taskTemplatePresetDialogClasses";

type TaskTemplatePresetDialogProps = {
  presets: TaskTemplatePreset[];
  presetsLoading: boolean;
  presetUsage: TemplateUsageMap;
  preferredAnalysisMode?: AnalysisMode;
  selectedPresetId: string;
  setSelectedPresetId: (value: string) => void;
  onApply: () => void;
  onClose: () => void;
};

export function TaskTemplatePresetDialog({
  presets,
  presetsLoading,
  presetUsage,
  preferredAnalysisMode,
  selectedPresetId,
  setSelectedPresetId,
  onApply,
  onClose,
}: TaskTemplatePresetDialogProps) {
  const { t } = useTranslation();
  const resolvedAnalysisMode: AnalysisMode = preferredAnalysisMode ?? "leaderboard";
  const defaultFilter: AnalysisMode | "all" = analysisModeSupportsTaskPresets(
    resolvedAnalysisMode,
  )
    ? resolvedAnalysisMode
    : "leaderboard";
  const [filter, setFilter] = React.useState<AnalysisMode | "all">(defaultFilter);
  const [searchQuery, setSearchQuery] = React.useState("");

  const displayTypeOrder: AnalysisMode[] = React.useMemo(
    () =>
      [resolvedAnalysisMode, ...taskFormAnalysisModeOrder].filter(
        (value, index, list): value is AnalysisMode =>
          list.indexOf(value) === index && analysisModeSupportsTaskPresets(value),
      ),
    [resolvedAnalysisMode],
  );

  const visiblePresets = React.useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return presets.filter((preset) => {
      if (!analysisModeSupportsTaskPresets(preset.analysisMode)) {
        return false;
      }
      if (filter !== "all" && preset.analysisMode !== filter) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const localized = localizeTaskPreset(preset, t);
      const haystacks = [
        localized.name,
        localized.description,
        preset.badge,
        formatAnalysisMode(preset.analysisMode),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [filter, presets, searchQuery, t]);

  const usageRankedPresets = React.useMemo(() => {
    const ranked = [...visiblePresets].filter((preset) => presetUsage[preset.id]);
    ranked.sort((left, right) => {
      const leftUsage = presetUsage[left.id];
      const rightUsage = presetUsage[right.id];
      const leftMatch = left.analysisMode === resolvedAnalysisMode ? 1 : 0;
      const rightMatch = right.analysisMode === resolvedAnalysisMode ? 1 : 0;
      if (leftMatch !== rightMatch) {
        return rightMatch - leftMatch;
      }
      if ((leftUsage?.useCount ?? 0) !== (rightUsage?.useCount ?? 0)) {
        return (rightUsage?.useCount ?? 0) - (leftUsage?.useCount ?? 0);
      }
      return (rightUsage?.lastUsedAt ?? "").localeCompare(leftUsage?.lastUsedAt ?? "");
    });
    return ranked;
  }, [presetUsage, resolvedAnalysisMode, visiblePresets]);

  const featuredPresets = React.useMemo(() => {
    if (usageRankedPresets.length > 0) {
      return usageRankedPresets.slice(0, 4);
    }
    return visiblePresets.filter(
      (preset) => preset.analysisMode === resolvedAnalysisMode,
    );
  }, [resolvedAnalysisMode, usageRankedPresets, visiblePresets]);

  const groupedPresets = React.useMemo(() => {
    const grouped = new Map<AnalysisMode, TaskTemplatePreset[]>();
    const featuredIds = new Set(
      filter === "all" ? featuredPresets.map((preset) => preset.id) : [],
    );

    for (const displayType of displayTypeOrder) {
      const groupItems = visiblePresets.filter((preset) => {
        if (preset.analysisMode !== displayType) {
          return false;
        }
        if (featuredIds.size > 0 && featuredIds.has(preset.id)) {
          return false;
        }
        return true;
      });
      if (groupItems.length > 0) {
        grouped.set(displayType, groupItems);
      }
    }

    return grouped;
  }, [displayTypeOrder, featuredPresets, filter, visiblePresets]);

  React.useEffect(() => {
    setFilter(
      analysisModeSupportsTaskPresets(resolvedAnalysisMode)
        ? resolvedAnalysisMode
        : "leaderboard",
    );
  }, [resolvedAnalysisMode]);

  React.useEffect(() => {
    if (presetsLoading || visiblePresets.length === 0) {
      return;
    }
    if (!visiblePresets.some((preset) => preset.id === selectedPresetId)) {
      setSelectedPresetId(visiblePresets[0].id);
    }
  }, [presetsLoading, selectedPresetId, setSelectedPresetId, visiblePresets]);

  return (
    <ModalDialog
      open
      title={t("tasks:template.title")}
      onClose={onClose}
      shellClassName={presetDialogContainerClass}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("dialog.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={onApply}
            disabled={!selectedPresetId || presetsLoading || visiblePresets.length === 0}
          >
            {t("tasks:template.apply")}
          </Button>
        </>
      }
    >
        <div className={presetDialogFilterGridClass}>
          <div className={presetDialogFilterChipRowClass}>
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
            >
              {t("tasks:template.all")}
            </FilterChip>
            {displayTypeOrder.map((displayType) => (
              <FilterChip
                key={displayType}
                active={filter === displayType}
                onClick={() => setFilter(displayType)}
              >
                {getTaskFormAnalysisModeMeta(displayType).displayLabel}
              </FilterChip>
            ))}
          </div>

          <div className={presetDialogSearchGridClass}>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("tasks:template.searchPlaceholder")}
              className={presetDialogSearchInputClass}
            />
            <div className="text-xs text-text-muted">
              {t("tasks:template.showing", {
                visible: visiblePresets.length,
                total: presets.length,
              })}
              {filter !== "all" &&
                t("tasks:template.filteredMode", { mode: formatAnalysisMode(filter) })}
            </div>
          </div>
        </div>

        <div className={presetDialogScrollableClass}>
          {presetsLoading ? (
            <StateMessage>{t("tasks:template.loading")}</StateMessage>
          ) : presets.length === 0 ? (
            <StateMessage>{t("tasks:template.empty")}</StateMessage>
          ) : visiblePresets.length === 0 ? (
            <StateMessage detail={t("tasks:template.noMatchHint")}>
              {t("tasks:template.noMatch")}
            </StateMessage>
          ) : (
            <div className={presetDialogGroupGridClass}>
              {filter === "all" && featuredPresets.length > 0 && (
                <PresetGroupSection
                  title={t("tasks:template.commonTitle")}
                  description={
                    usageRankedPresets.length > 0
                      ? t("tasks:template.sortedWithMode", {
                          mode: formatAnalysisMode(resolvedAnalysisMode),
                        })
                      : t("tasks:template.pinnedMode", {
                          mode: formatAnalysisMode(resolvedAnalysisMode),
                        })
                  }
                  presets={featuredPresets}
                  selectedPresetId={selectedPresetId}
                  preferredAnalysisMode={resolvedAnalysisMode}
                  setSelectedPresetId={setSelectedPresetId}
                />
              )}

              {Array.from(groupedPresets.entries()).map(
                ([displayType, groupPresets]) => (
                  <PresetGroupSection
                    key={displayType}
                    title={formatAnalysisMode(displayType)}
                    description={t("tasks:template.viewMode", {
                      mode: formatAnalysisMode(displayType),
                    })}
                    presets={groupPresets}
                    selectedPresetId={selectedPresetId}
                    preferredAnalysisMode={resolvedAnalysisMode}
                    setSelectedPresetId={setSelectedPresetId}
                  />
                ),
              )}
            </div>
          )}
        </div>
    </ModalDialog>
  );
}
