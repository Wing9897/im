import type { AddAccountResponse, RefreshAllAccountsResponse } from "../../../types";
import i18n from "../../../i18n";
import { joinList } from "../../../i18n/formatMessage";

export type VerifyStep = "code_required" | "2fa_required" | "qr_required" | null;

export interface VerificationStart {
  accountId: string;
  step: Exclude<VerifyStep, null>;
  pendingLoginStage?: Exclude<VerifyStep, null> | null;
  phoneCodeHash?: string | null;
  qrUrl?: string | null;
  qrExpiresAt?: string | null;
}

export function buildRefreshAllNotice(
  summary: Pick<
    RefreshAllAccountsResponse,
    | "totalAccounts"
    | "connectedCount"
    | "verificationRequiredCount"
    | "errorCount"
  >,
): string {
  if (summary.totalAccounts === 0) {
    return String(i18n.t("sources:accounts.refreshNone"));
  }

  const parts = [
    String(
      i18n.t("sources:accounts.refreshUpdated", { count: summary.connectedCount }),
    ),
    summary.verificationRequiredCount > 0
      ? String(
          i18n.t("sources:accounts.refreshNeedVerify", {
            count: summary.verificationRequiredCount,
          }),
        )
      : null,
    summary.errorCount > 0
      ? String(
          i18n.t("sources:accounts.refreshFailed", { count: summary.errorCount }),
        )
      : null,
  ];

  return String(
    i18n.t("sources:accounts.refreshDone", { parts: joinList(parts) }),
  );
}

export function getVerificationStart(
  response: AddAccountResponse,
): VerificationStart | null {
  if (
    response.nextStep !== "code_required" &&
    response.nextStep !== "2fa_required" &&
    response.nextStep !== "qr_required"
  ) {
    return null;
  }

  return {
    accountId: response.account.id,
    step: response.nextStep,
    pendingLoginStage: response.pendingLoginStage,
    phoneCodeHash: response.phoneCodeHash,
    qrUrl: response.qrUrl,
    qrExpiresAt: response.qrExpiresAt,
  };
}
