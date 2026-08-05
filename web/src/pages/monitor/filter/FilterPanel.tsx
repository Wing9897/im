import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SourceChannelPickerContent } from "../../../components/channels/SourceChannelPickerContent";
import { PlatformFilterChips } from "../../../components/channels/PlatformFilterChips";
import { SelectField, TextField } from "../../../components/ui";
import type {
  Source,
  ChannelWithSource,
  MessageFilters,
  MessageTimeRange,
} from "../../../types";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import { uniquePlatformsFrom } from "../../../utils/platformFilter";

interface FilterPanelProps {
  filters: MessageFilters;
  onFiltersChange: (filters: MessageFilters) => void;
  sources: Source[];
  channels: ChannelWithSource[];
}

const SEARCH_DEBOUNCE_MS = 400;

function filterIdsByPlatform<T extends { id: string; platform: string }>(
  ids: string[] | undefined,
  items: T[],
  platform: string | undefined,
): string[] | undefined {
  if (!platform || !ids?.length) return ids;
  const filtered = ids.filter((id) =>
    items.some((item) => item.id === id && item.platform === platform),
  );
  return filtered.length > 0 ? filtered : undefined;
}

/** Filter form fields shared by the monitor filter dialog. */
export function FilterPanel({
  filters,
  onFiltersChange,
  sources,
  channels,
}: FilterPanelProps) {
  const { t } = useTranslation("monitor");
  const [searchDraft, setSearchDraft] = useState(filters.search ?? "");

  // Product subset of MessageTimeRange for the monitor filter UI.
  // Full token set (incl. 12h/24h/1h/…) is accepted via URL — see useMonitorFiltersUrl.
  const timeRangeOptions: { value: MessageTimeRange | ""; label: string }[] = [
    { value: "", label: t("filter.timeAll") },
    { value: "today", label: t("filter.timeToday") },
    { value: "7d", label: t("filter.time7d") },
    { value: "30d", label: t("filter.time30d") },
  ];

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const onFiltersChangeRef = useRef(onFiltersChange);
  onFiltersChangeRef.current = onFiltersChange;

  useEffect(() => {
    setSearchDraft(filters.search ?? "");
  }, [filters.search]);

  useEffect(() => {
    const trimmed = searchDraft.trim();
    const current = filtersRef.current.search ?? "";
    if (trimmed === current.trim()) return;
    const timer = setTimeout(() => {
      onFiltersChangeRef.current({ ...filtersRef.current, search: trimmed || undefined });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchDraft]);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({ ...filters, sourceIds: value ? [value] : undefined });
  };

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as MessageTimeRange | "";
    onFiltersChange({ ...filters, timeRange: value || undefined });
  };

  const selectPlatform = (platform: string | undefined) => {
    const nextPlatform = platform || undefined;
    onFiltersChange({
      ...filters,
      platform: nextPlatform,
      channelIds: filterIdsByPlatform(filters.channelIds, channels, nextPlatform),
      sourceIds: filterIdsByPlatform(filters.sourceIds, sources, nextPlatform),
    });
  };

  const selectedChannels = filters.channelIds ?? [];
  const selectedTimeRange = filters.timeRange ?? "";
  const selectedPlatform = filters.platform ?? "";
  const selectedSources = filters.sourceIds ?? [];

  const uniquePlatforms = useMemo(
    () => uniquePlatformsFrom(sources, channels),
    [sources, channels],
  );

  const visibleSources = useMemo(
    () =>
      selectedPlatform
        ? sources.filter((source) => source.platform === selectedPlatform)
        : sources,
    [sources, selectedPlatform],
  );

  const visibleChannels = useMemo(
    () =>
      selectedPlatform
        ? channels.filter((channel) => channel.platform === selectedPlatform)
        : channels,
    [channels, selectedPlatform],
  );

  return (
    <div className="im-filter-panel im-filter-panel--monitor" data-testid="monitor-filter-panel">
      <div className="im-filter-panel-top">
        <div className="relative">
          <Search
            size={14}
            strokeWidth={2}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <TextField
            className="!pl-9"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={t("filter.searchPlaceholder")}
            aria-label={t("filter.searchAria")}
          />
        </div>

        {uniquePlatforms.length > 0 && (
          <PlatformFilterChips
            platforms={uniquePlatforms}
            selectedPlatform={selectedPlatform}
            onSelect={selectPlatform}
            variant="segmented"
          />
        )}

        <div className="im-filter-panel-row im-filter-panel-meta-row">
          <div className="im-filter-panel-field">
            <SelectField
              value={selectedSources[0] ?? ""}
              onChange={handleSourceChange}
              aria-label={t("filter.sourceAria")}
            >
              <option value="">{t("filter.sourceAll")}</option>
              {visibleSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {formatSourceLabel(source)}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="im-filter-panel-field">
            <SelectField
              value={selectedTimeRange}
              onChange={handleTimeRangeChange}
              aria-label={t("filter.timeAria")}
            >
              {timeRangeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </div>

      <div className="im-filter-panel-channels im-channel-picker-dialog">
        <SourceChannelPickerContent
          channels={visibleChannels}
          selectedIds={selectedChannels}
          onChange={(channelIds) =>
            onFiltersChange({
              ...filters,
              channelIds: channelIds.length > 0 ? channelIds : undefined,
            })
          }
          summaryLabel={t("filter.channelSummary")}
          emptyMessage={t("filter.channelEmpty")}
          searchable={visibleChannels.length > 6}
          hidePlatformHeaders={Boolean(selectedPlatform)}
          fillAvailableHeight={true}
          listMaxHeight={0}
          testId="monitor-filter-channel-picker"
        />
      </div>
    </div>
  );
}
