import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyStateSources } from "../../../assets/illustrations/EmptyStateIllustrations";
import { AlertBanner, Button } from "../../../components/ui";
import { formatSourceLabel } from "../../../utils/sourceDisplay";
import type { Source } from "../../../types";
import { ReconnectButton } from "../board/ReconnectButton";
import { SourceCard, SourceCardErrorLines } from "../board/SourceCard";
import { TelegramSourceDetailDialog } from "./TelegramSourceDetailDialog";
import { SourceListSection } from "../board/SourceListSection";

interface TelegramSourceListSectionProps {
  sources: Source[];
  initialLoading: boolean;
  isRefreshing: boolean;
  refreshingAllSources: boolean;
  refreshAllNotice: string | null;
  reconnecting: string | null;
  reconnectError: string | null;
  reconnectErrorTarget: string | null;
  onRefreshAll: () => Promise<void>;
  onReconnect: (sourceId: string) => Promise<void>;
  onRemoveClick: (sourceId: string) => void;
  onEditClick: (source: Source) => void;
}

export function TelegramSourceListSection({
  sources,
  initialLoading,
  isRefreshing,
  refreshingAllSources,
  refreshAllNotice,
  reconnecting,
  reconnectError,
  reconnectErrorTarget,
  onRefreshAll,
  onReconnect,
  onRemoveClick,
  onEditClick,
}: TelegramSourceListSectionProps) {
  const { t } = useTranslation("sources");
  const [detailSource, setDetailSource] = useState<Source | null>(null);
  const refreshDisabled =
    initialLoading ||
    isRefreshing ||
    sources.length === 0 ||
    refreshingAllSources ||
    reconnecting !== null;

  const handleRefreshAll = useCallback(
    () => void onRefreshAll().catch(() => {}),
    [onRefreshAll],
  );

  const refreshAllNoticeBanner = refreshAllNotice ? (
    <AlertBanner variant="success">{refreshAllNotice}</AlertBanner>
  ) : null;

  return (
    <>
    <SourceListSection
      title={t("sources.listTitle")}
      itemCount={sources.length}
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
      refreshingLabel={t("sources.refreshing")}
      headerActions={
        <Button
          variant="secondary"
          disabled={refreshDisabled}
          onClick={handleRefreshAll}
        >
          {refreshingAllSources
            ? t("sources.refreshingAll")
            : t("sources.refreshAll")}
        </Button>
      }
      notice={refreshAllNoticeBanner}
      emptyState={{
        title: t("sources.emptyTitle"),
        description: t("sources.emptyDescription"),
        hint: t("sources.emptyHint"),
        illustration: <EmptyStateSources />,
      }}
    >
      {sources.map((source) => (
        <TelegramSourceCard
          key={source.id}
          source={source}
          reconnecting={reconnecting}
          reconnectError={reconnectError}
          reconnectErrorTarget={reconnectErrorTarget}
          refreshingAllSources={refreshingAllSources}
          onReconnect={onReconnect}
          onRemoveClick={onRemoveClick}
          onEditClick={() => onEditClick(source)}
          onSelectClick={() => setDetailSource(source)}
        />
      ))}
    </SourceListSection>

    {detailSource ? (
      <TelegramSourceDetailDialog
        source={detailSource}
        onClose={() => setDetailSource(null)}
      />
    ) : null}
    </>
  );
}

function TelegramSourceCard({
  source,
  reconnecting,
  reconnectError,
  reconnectErrorTarget,
  refreshingAllSources,
  onReconnect,
  onRemoveClick,
  onEditClick,
  onSelectClick,
}: {
  source: Source;
  reconnecting: string | null;
  reconnectError: string | null;
  reconnectErrorTarget: string | null;
  refreshingAllSources: boolean;
  onReconnect: (sourceId: string) => Promise<void>;
  onRemoveClick: (sourceId: string) => void;
  onEditClick: () => void;
  onSelectClick: () => void;
}) {
  const { t } = useTranslation("sources");
  const handleReconnect = useCallback(
    () => void onReconnect(source.id).catch(() => {}),
    [onReconnect, source.id],
  );

  const handleRemove = useCallback(
    () => onRemoveClick(source.id),
    [onRemoveClick, source.id],
  );

  return (
    <SourceCard
      platform="telegram"
      status={source.status}
      title={formatSourceLabel(source)}
      subtitle={t("telegram.sourceSubtitle")}
      onSelect={onSelectClick}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onEditClick}>
            {t("shared.edit")}
          </Button>
          <ReconnectButton
            show={source.status !== "connected"}
            reconnecting={reconnecting === source.id}
            disabled={refreshingAllSources}
            onReconnect={handleReconnect}
          />
          <Button variant="danger" size="sm" onClick={handleRemove}>
            {t("shared.remove")}
          </Button>
        </>
      }
    >
      <SourceCardErrorLines
        status={source.status}
        sourceLastError={source.lastError}
        reconnectError={
          reconnectError && reconnecting === null && reconnectErrorTarget === source.id
            ? reconnectError
            : null
        }
      />
      {reconnecting === source.id && (
        <div className="mt-xs text-[11px] text-text-muted">
          {t("telegram.connectingCard")}
        </div>
      )}
    </SourceCard>
  );
}
