import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listAccounts } from "../../api/accounts";
import { Badge } from "../../components/ui";
import { formatStatusLabel } from "../../styles/statusDot";
import type { Account, ConnectionStatus } from "../../types";
import { platformDisplayLabel } from "../../utils/platformRegistry";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

function statusTone(status: ConnectionStatus): "success" | "danger" | "neutral" {
  if (status === "connected") return "success";
  if (status === "error") return "danger";
  return "neutral";
}

/** Compact source-account status list for ops board. */
export function SourcesBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => listAccounts(), []);
  const { data: accounts, error, loading, refresh } = useBoardWidgetPoll<Account[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  return (
    <div className="board-widget-body board-widget-sources" data-testid="board-sources-widget">
      <BoardWidgetShell
        loading={loading && !accounts}
        error={!accounts ? error : null}
        onRetry={refresh}
        empty={Array.isArray(accounts) && accounts.length === 0}
        emptyLabel={t("board.sources.empty")}
      >
        {accounts && accounts.length > 0 ? (
          <ul className="board-widget-list">
            {accounts.map((account) => (
              <li key={account.id} className="board-widget-list__item">
                <button
                  type="button"
                  className="board-widget-list__row board-sources-row"
                  data-testid={`board-sources-row-${account.id}`}
                >
                  <span className="board-sources-row__title">
                    <span className="board-widget-list__primary">
                      {account.name || account.id}
                    </span>
                    <Badge tone="neutral" className="board-sources-row__platform">
                      {platformDisplayLabel(account.platform)}
                    </Badge>
                  </span>
                  <Badge tone={statusTone(account.status)}>
                    {formatStatusLabel(account.status)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}
