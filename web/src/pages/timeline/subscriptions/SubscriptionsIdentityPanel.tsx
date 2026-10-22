import { SubscriptionsIdentityConnected } from "./SubscriptionsIdentityConnected";
import { SubscriptionsIdentityLogin } from "./SubscriptionsIdentityLogin";
import { useSubscriptionsIdentity } from "./useSubscriptionsIdentity";

/** Subscriptions workspace identity chrome: calendar-share login, avatar, and timezone. */
export function SubscriptionsIdentityPanel() {
  const identity = useSubscriptionsIdentity();
  return identity.connected ? (
    <SubscriptionsIdentityConnected identity={identity} />
  ) : (
    <SubscriptionsIdentityLogin identity={identity} />
  );
}
