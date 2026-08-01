import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { EmptyStateSources } from "../../../assets/illustrations/EmptyStateIllustrations";
import { AlertBanner, Button } from "../../../components/ui";
import { formatAccountLabel } from "../../../utils/accountDisplay";
import type { Account } from "../../../types";
import { ReconnectButton } from "../ReconnectButton";
import { SourceCard, SourceCardErrorLines } from "../SourceCard";
import { TelegramAccountDetailDialog } from "./TelegramAccountDetailDialog";
import { SourceListSection } from "../SourceListSection";

interface AccountListSectionProps {
  accounts: Account[];
  initialLoading: boolean;
  isRefreshing: boolean;
  refreshingAllAccounts: boolean;
  refreshAllNotice: string | null;
  reconnecting: string | null;
  reconnectError: string | null;
  reconnectErrorTarget: string | null;
  onRefreshAll: () => Promise<void>;
  onReconnect: (accountId: string) => Promise<void>;
  onRemoveClick: (accountId: string) => void;
  onEditClick: (account: Account) => void;
}

export function AccountListSection({
  accounts,
  initialLoading,
  isRefreshing,
  refreshingAllAccounts,
  refreshAllNotice,
  reconnecting,
  reconnectError,
  reconnectErrorTarget,
  onRefreshAll,
  onReconnect,
  onRemoveClick,
  onEditClick,
}: AccountListSectionProps) {
  const { t } = useTranslation("sources");
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const refreshDisabled =
    initialLoading ||
    isRefreshing ||
    accounts.length === 0 ||
    refreshingAllAccounts ||
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
      title={t("accounts.listTitle")}
      itemCount={accounts.length}
      initialLoading={initialLoading}
      isRefreshing={isRefreshing}
      refreshingLabel={t("accounts.refreshing")}
      headerActions={
        <Button
          variant="secondary"
          disabled={refreshDisabled}
          onClick={handleRefreshAll}
        >
          {refreshingAllAccounts
            ? t("accounts.refreshingAll")
            : t("accounts.refreshAll")}
        </Button>
      }
      notice={refreshAllNoticeBanner}
      emptyState={{
        title: t("accounts.emptyTitle"),
        description: t("accounts.emptyDescription"),
        hint: t("accounts.emptyHint"),
        illustration: <EmptyStateSources />,
      }}
    >
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          reconnecting={reconnecting}
          reconnectError={reconnectError}
          reconnectErrorTarget={reconnectErrorTarget}
          refreshingAllAccounts={refreshingAllAccounts}
          onReconnect={onReconnect}
          onRemoveClick={onRemoveClick}
          onEditClick={() => onEditClick(account)}
          onSelectClick={() => setDetailAccount(account)}
        />
      ))}
    </SourceListSection>

    {detailAccount ? (
      <TelegramAccountDetailDialog
        account={detailAccount}
        onClose={() => setDetailAccount(null)}
      />
    ) : null}
    </>
  );
}

function AccountCard({
  account,
  reconnecting,
  reconnectError,
  reconnectErrorTarget,
  refreshingAllAccounts,
  onReconnect,
  onRemoveClick,
  onEditClick,
  onSelectClick,
}: {
  account: Account;
  reconnecting: string | null;
  reconnectError: string | null;
  reconnectErrorTarget: string | null;
  refreshingAllAccounts: boolean;
  onReconnect: (accountId: string) => Promise<void>;
  onRemoveClick: (accountId: string) => void;
  onEditClick: () => void;
  onSelectClick: () => void;
}) {
  const { t } = useTranslation("sources");
  const handleReconnect = useCallback(
    () => void onReconnect(account.id).catch(() => {}),
    [onReconnect, account.id],
  );

  const handleRemove = useCallback(
    () => onRemoveClick(account.id),
    [onRemoveClick, account.id],
  );

  return (
    <SourceCard
      platform="telegram"
      status={account.status}
      title={formatAccountLabel(account)}
      subtitle={t("telegram.accountSubtitle")}
      onSelect={onSelectClick}
      actions={
        <>
          <Button variant="secondary" size="sm" onClick={onEditClick}>
            {t("shared.edit")}
          </Button>
          <ReconnectButton
            show={account.status !== "connected"}
            reconnecting={reconnecting === account.id}
            disabled={refreshingAllAccounts}
            onReconnect={handleReconnect}
          />
          <Button variant="danger" size="sm" onClick={handleRemove}>
            {t("shared.remove")}
          </Button>
        </>
      }
    >
      <SourceCardErrorLines
        status={account.status}
        accountLastError={account.lastError}
        reconnectError={
          reconnectError && reconnecting === null && reconnectErrorTarget === account.id
            ? reconnectError
            : null
        }
      />
      {reconnecting === account.id && (
        <div className="mt-xs text-[11px] text-text-muted">
          {t("telegram.connectingCard")}
        </div>
      )}
    </SourceCard>
  );
}
