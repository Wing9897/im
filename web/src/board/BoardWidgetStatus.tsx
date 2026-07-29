import type { ReactNode } from "react";
import i18n from "../i18n";

interface BoardWidgetErrorProps {
  /** Optional detail; UI always shows a short unified label. */
  detail?: string | null;
  onRetry: () => void;
}

/** Unified error + retry control for board widget bodies. */
function BoardWidgetError({ detail, onRetry }: BoardWidgetErrorProps) {
  return (
    <div className="board-widget-status board-widget-status--error" data-testid="board-widget-error">
      <p className="board-widget-muted">{String(i18n.t("board.shell.loadFailed"))}</p>
      {detail ? (
        <p className="board-widget-status__detail" title={detail}>
          {detail}
        </p>
      ) : null}
      <button
        type="button"
        className="board-widget-link-btn"
        data-testid="board-widget-retry"
        onClick={onRetry}
      >
        {String(i18n.t("board.shell.retry"))}
      </button>
    </div>
  );
}

interface BoardWidgetEmptyProps {
  children: ReactNode;
}

export function BoardWidgetEmpty({ children }: BoardWidgetEmptyProps) {
  return (
    <p className="board-widget-muted" data-testid="board-widget-empty">
      {children}
    </p>
  );
}

interface BoardWidgetShellProps {
  active?: boolean;
  pausedLabel?: string;
  pausedTestId?: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  empty?: boolean;
  emptyLabel?: ReactNode;
  children: ReactNode;
}

/**
 * Thin status shell for board widgets: paused → loading → error → empty → content.
 * Heavy embeds pass `pausedLabel` so maximize / pages-inactive unmount their bodies.
 */
export function BoardWidgetShell({
  active = true,
  pausedLabel,
  pausedTestId,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyLabel,
  children,
}: BoardWidgetShellProps) {
  if (!active && pausedLabel) {
    return (
      <div className="board-embed-paused" data-testid={pausedTestId}>
        {pausedLabel}
      </div>
    );
  }

  if (loading) {
    return <p className="board-widget-muted">{String(i18n.t("ui.loading"))}</p>;
  }

  if (error) {
    return <BoardWidgetError detail={error} onRetry={onRetry ?? (() => {})} />;
  }

  if (empty) {
    return <BoardWidgetEmpty>{emptyLabel}</BoardWidgetEmpty>;
  }

  return <>{children}</>;
}
