import { forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { DataListFooter } from "./DataList";
import { PillButton } from "./PillButton";

export interface LoadMoreFooterProps {
  /** Status / hint line above the button. */
  hint: string;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  loadMoreLabel?: string;
  loadMoreAriaLabel?: string;
  /** When true, render as DataListFooter; otherwise a plain centered footer. */
  asDataListFooter?: boolean;
  className?: string;
}

/**
 * Shared infinite-scroll sentinel + load-more control for list/card feeds.
 */
export const LoadMoreFooter = forwardRef<HTMLDivElement, LoadMoreFooterProps>(
  function LoadMoreFooter(
    {
      hint,
      hasMore,
      loadingMore,
      onLoadMore,
      loadMoreLabel,
      loadMoreAriaLabel,
      asDataListFooter = true,
      className,
    },
    ref,
  ) {
    const { t } = useTranslation();
    const label = loadMoreLabel ?? t("messages.loadMore");
    const aria = loadMoreAriaLabel ?? t("messages.loadMore");
    const body = (
      <>
        <div className="text-caption text-text-muted">{hint}</div>
        {hasMore && !loadingMore ? (
          <PillButton aria-label={aria} onClick={onLoadMore}>
            {label}
          </PillButton>
        ) : null}
      </>
    );

    if (asDataListFooter) {
      return (
        <DataListFooter
          ref={ref}
          className={["text-caption text-text-muted", className ?? ""]
            .filter(Boolean)
            .join(" ")}
        >
          {body}
        </DataListFooter>
      );
    }

    return (
      <div
        ref={ref}
        className={[
          "flex flex-col items-center gap-sm border-t border-[color-mix(in_srgb,var(--surface-border)_40%,transparent)] px-lg py-lg text-center text-caption text-text-muted",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {body}
      </div>
    );
  },
);
