import type { Account } from "../types";
import type { ChannelWithAccount } from "../types/channels";
import i18n from "../i18n";

/** Display label for an account using the canonical `name` field. */
export function formatAccountLabel(
  account: Pick<Account, "name">,
): string {
  const name = account.name?.trim();
  return name || String(i18n.t("ui.unnamedAccount"));
}

/** Label for a channel's linked account (server-populated `accountName`). */
export function formatChannelAccountLabel(
  channel: Pick<ChannelWithAccount, "accountName">,
): string {
  return channel.accountName?.trim() || "";
}
