import type { AddSourceResponse, RefreshAllSourcesResponse } from "../../../types";
import i18n from "../../../i18n";
import { joinList } from "../../../i18n/formatMessage";

export type VerifyStep = "code_required" | "2fa_required" | "qr_required" | null;

export interface VerificationStart {
  sourceId: string;
  step: Exclude<VerifyStep, null>;
  pendingLoginStage?: Exclude<VerifyStep, null> | null;
  phoneCodeHash?: string | null;
  qrUrl?: string | null;
  qrExpiresAt?: string | null;
}

export function buildRefreshAllNotice(
  summary: Pick<
    RefreshAllSourcesResponse,
    | "totalSources"
    | "connectedCount"
    | "verificationRequiredCount"
    | "errorCount"
  >,
): string {
  if (summary.totalSources === 0) {
    return String(i18n.t("sources:sources.refreshNone"));
  }

  const parts = [
    String(
      i18n.t("sources:sources.refreshUpdated", { count: summary.connectedCount }),
    ),
    summary.verificationRequiredCount > 0
      ? String(
          i18n.t("sources:sources.refreshNeedVerify", {
            count: summary.verificationRequiredCount,
          }),
        )
      : null,
    summary.errorCount > 0
      ? String(
          i18n.t("sources:sources.refreshFailed", { count: summary.errorCount }),
        )
      : null,
  ];

  return String(
    i18n.t("sources:sources.refreshDone", { parts: joinList(parts) }),
  );
}

export function getVerificationStart(
  response: AddSourceResponse,
): VerificationStart | null {
  if (
    response.nextStep !== "code_required" &&
    response.nextStep !== "2fa_required" &&
    response.nextStep !== "qr_required"
  ) {
    return null;
  }

  return {
    sourceId: response.source.id,
    step: response.nextStep,
    pendingLoginStage: response.pendingLoginStage,
    phoneCodeHash: response.phoneCodeHash,
    qrUrl: response.qrUrl,
    qrExpiresAt: response.qrExpiresAt,
  };
}
