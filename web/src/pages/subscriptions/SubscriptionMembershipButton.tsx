import { UserMinus, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui";

type SubscriptionMembershipButtonProps = {
  subscribed: boolean;
  canMutate: boolean;
  busy: boolean;
  actionsLocked: boolean;
  identityKey: string;
  onSubscribe: () => void;
  onUnsubscribe: () => void;
};

/** Search card action: subscribe or unsubscribe with shared busy/disabled rules. */
export function SubscriptionMembershipButton({
  subscribed,
  canMutate,
  busy,
  actionsLocked,
  identityKey,
  onSubscribe,
  onUnsubscribe,
}: SubscriptionMembershipButtonProps) {
  const { t } = useTranslation("subscriptions");

  if (subscribed) {
    const label = busy ? t("mine.removing") : t("mine.remove");
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={!canMutate || actionsLocked}
        aria-label={label}
        title={label}
        onClick={onUnsubscribe}
        data-testid={`subscriptions-unsubscribe-${identityKey}`}
      >
        {!busy ? <UserMinus size={16} strokeWidth={2.5} aria-hidden="true" /> : null}
        <span>{label}</span>
      </Button>
    );
  }

  const label = busy ? t("search.adding") : t("search.add");
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={busy}
      disabled={!canMutate || actionsLocked}
      aria-label={label}
      title={label}
      onClick={onSubscribe}
      data-testid={`subscriptions-add-${identityKey}`}
    >
      {!busy ? <UserPlus size={16} strokeWidth={2.5} aria-hidden="true" /> : null}
      <span>{label}</span>
    </Button>
  );
}
