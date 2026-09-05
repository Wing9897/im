import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "../../../components/common/EmptyState";
import { RefreshIndicator } from "../../../components/common/RefreshIndicator";
import { SkeletonScreen } from "../../../components/common/SkeletonScreen";
import { PanelSection } from "../../../components/ui";

interface SourceListEmptyState {
  title: string;
  description: string;
  hint?: string;
  illustration?: ReactNode;
}

interface SourceListSectionProps {
  title: string;
  itemCount: number;
  headerActions?: ReactNode;
  notice?: ReactNode;
  initialLoading: boolean;
  isRefreshing?: boolean;
  refreshingLabel?: string;
  emptyState?: SourceListEmptyState;
  children: ReactNode;
}

export function SourceListSection({
  title,
  itemCount,
  headerActions,
  notice,
  initialLoading,
  isRefreshing = false,
  refreshingLabel,
  emptyState,
  children,
}: SourceListSectionProps) {
  const { t } = useTranslation("sources");
  const resolvedRefreshing = refreshingLabel ?? t("layout.refreshing");
  const showCountBadge = !initialLoading || itemCount > 0;
  const showEmpty = !initialLoading && itemCount === 0 && emptyState;
  const showCards = itemCount > 0;

  return (
    <PanelSection
      title={title}
      itemCount={itemCount}
      showCount={showCountBadge}
      surface="none"
      headerActions={
        <>
          {isRefreshing ? <RefreshIndicator label={resolvedRefreshing} /> : null}
          {headerActions}
        </>
      }
      bodyClassName="min-w-0 flex-1"
    >
      {notice}

      {initialLoading ? <SkeletonScreen variant="list-rows" /> : null}

      {showEmpty ? (
        <EmptyState
          title={emptyState.title}
          description={emptyState.description}
          hint={emptyState.hint}
          illustration={emptyState.illustration}
          illustrationKey="sources"
        />
      ) : null}

      {showCards ? (
        <div className="sources-card-grid flex flex-col gap-card-gap xl:grid xl:grid-cols-2 xl:gap-card-gap">
          {children}
        </div>
      ) : null}
    </PanelSection>
  );
}
