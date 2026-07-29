import { useCallback, useEffect, useRef, useState } from "react";
import {
  submitTelegram2fa,
  submitTelegramCode,
  waitTelegramQrLogin,
} from "../../../api/accounts";
import { toErrorMessage } from "../../../utils/errors";
import type { VerificationStart, VerifyStep } from "../accounts/accountsPageModel";
import i18n from "../../../i18n";

interface TelegramVerificationState {
  verifyStep: VerifyStep;
  verifyCode: string;
  setVerifyCode: (value: string) => void;
  verifyPassword: string;
  setVerifyPassword: (value: string) => void;
  verifyError: string | null;
  verifySubmitting: boolean;
  qrUrl: string | null;
  qrExpiresAt: string | null;
  qrWaiting: boolean;
  startVerification: (params: VerificationStart) => void;
  closeVerifyDialog: () => void;
  handleSubmitCode: () => Promise<void>;
  handleSubmit2fa: () => Promise<void>;
}

/**
 * Sub-hook managing the Telegram verification flow (code / QR / 2FA).
 * Extracted from useTelegramAccounts for single-responsibility.
 */
export function useTelegramVerification(deps: {
  clearAddAccountForm: () => void;
  fetchAccounts: () => Promise<void>;
}): TelegramVerificationState {
  const { clearAddAccountForm, fetchAccounts } = deps;

  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [verifyStep, setVerifyStep] = useState<VerifyStep>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyPassword, setVerifyPassword] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [pendingLoginStage, setPendingLoginStage] = useState<VerifyStep>(null);
  const [pendingPhoneCodeHash, setPendingPhoneCodeHash] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrExpiresAt, setQrExpiresAt] = useState<string | null>(null);
  const [qrWaiting, setQrWaiting] = useState(false);
  const qrPollGeneration = useRef(0);
  const fetchAccountsRef = useRef(fetchAccounts);
  fetchAccountsRef.current = fetchAccounts;

  const startVerification = useCallback((params: VerificationStart) => {
    setPendingAccountId(params.accountId);
    setVerifyStep(params.step);
    setPendingLoginStage(params.pendingLoginStage ?? params.step);
    setPendingPhoneCodeHash(params.phoneCodeHash ?? null);
    setQrUrl(params.qrUrl ?? null);
    setQrExpiresAt(params.qrExpiresAt ?? null);
    setVerifyError(null);
  }, []);

  const closeVerifyDialog = useCallback(() => {
    qrPollGeneration.current += 1;
    setPendingAccountId(null);
    setVerifyStep(null);
    setVerifyCode("");
    setVerifyPassword("");
    setVerifyError(null);
    setPendingLoginStage(null);
    setPendingPhoneCodeHash(null);
    setQrUrl(null);
    setQrExpiresAt(null);
    setQrWaiting(false);
    clearAddAccountForm();
  }, [clearAddAccountForm]);

  const closeVerifyDialogRef = useRef(closeVerifyDialog);
  closeVerifyDialogRef.current = closeVerifyDialog;

  useEffect(() => {
    if (verifyStep !== "qr_required" || !pendingAccountId) {
      return;
    }

    const generation = ++qrPollGeneration.current;
    let cancelled = false;
    setQrWaiting(true);

    const poll = async () => {
      while (!cancelled && qrPollGeneration.current === generation) {
        try {
          const resp = await waitTelegramQrLogin(pendingAccountId, {
            // Keep under the 90s HTTP budget so post-scan login work still fits.
            timeoutSeconds: 20,
          });
          if (cancelled || qrPollGeneration.current !== generation) {
            return;
          }
          if (resp.nextStep === "qr_required") {
            setQrUrl(resp.qrUrl ?? null);
            setQrExpiresAt(resp.qrExpiresAt ?? null);
            setPendingLoginStage(resp.pendingLoginStage ?? "qr_required");
            setVerifyError(null);
            continue;
          }
          if (resp.nextStep === "2fa_required") {
            setVerifyStep("2fa_required");
            setPendingLoginStage(resp.pendingLoginStage ?? "2fa_required");
            setQrUrl(null);
            setQrExpiresAt(null);
            setQrWaiting(false);
            return;
          }
          if (resp.nextStep === "connected") {
            closeVerifyDialogRef.current();
            await fetchAccountsRef.current();
            return;
          }
          setVerifyError(String(i18n.t("sources:verify.verifyFailed")));
          setQrWaiting(false);
          return;
        } catch (e) {
          if (cancelled || qrPollGeneration.current !== generation) {
            return;
          }
          // Transient network abort: keep polling instead of killing the QR dialog.
          const message = toErrorMessage(e);
          if (/timed out|timeout|abort/i.test(message)) {
            setVerifyError(null);
            continue;
          }
          setVerifyError(message);
          setQrWaiting(false);
          return;
        }
      }
    };

    void poll();
    return () => {
      cancelled = true;
      qrPollGeneration.current += 1;
      setQrWaiting(false);
    };
  }, [verifyStep, pendingAccountId]);

  const handleSubmitCode = async () => {
    const normalizedCode = verifyCode.trim();
    if (!pendingAccountId) return;
    if (!normalizedCode) {
      setVerifyError(String(i18n.t("sources:verify.codeRequired")));
      return;
    }
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      const resp = await submitTelegramCode(pendingAccountId, {
        code: normalizedCode,
        pendingLoginStage,
        phoneCodeHash: pendingPhoneCodeHash,
      });
      if (resp.nextStep === "code_required") {
        setVerifyStep("code_required");
        setPendingLoginStage(resp.pendingLoginStage ?? "code_required");
        setPendingPhoneCodeHash(resp.phoneCodeHash ?? null);
        setVerifyError(String(i18n.t("sources:verify.codeResent")));
      } else if (resp.nextStep === "2fa_required") {
        setVerifyStep("2fa_required");
        setVerifyCode("");
        setPendingLoginStage(resp.pendingLoginStage ?? "2fa_required");
        setPendingPhoneCodeHash(resp.phoneCodeHash ?? null);
      } else if (resp.nextStep === "connected") {
        closeVerifyDialog();
        await fetchAccounts();
      } else {
        setVerifyError(String(i18n.t("sources:verify.verifyFailed")));
      }
    } catch (e) {
      setVerifyError(toErrorMessage(e));
    } finally {
      setVerifySubmitting(false);
    }
  };

  const handleSubmit2fa = async () => {
    const normalizedPassword = verifyPassword.trim();
    if (!pendingAccountId) return;
    if (!normalizedPassword) {
      setVerifyError(String(i18n.t("sources:verify.passwordRequired")));
      return;
    }
    setVerifySubmitting(true);
    setVerifyError(null);
    try {
      const resp = await submitTelegram2fa(pendingAccountId, {
        password: normalizedPassword,
        pendingLoginStage,
        phoneCodeHash: pendingPhoneCodeHash,
      });
      if (resp.nextStep === "connected") {
        closeVerifyDialog();
        await fetchAccounts();
      } else {
        setVerifyError(String(i18n.t("sources:verify.twoFaFailed")));
      }
    } catch (e) {
      setVerifyError(toErrorMessage(e));
    } finally {
      setVerifySubmitting(false);
    }
  };

  return {
    verifyStep,
    verifyCode,
    setVerifyCode,
    verifyPassword,
    setVerifyPassword,
    verifyError,
    verifySubmitting,
    qrUrl,
    qrExpiresAt,
    qrWaiting,
    startVerification,
    closeVerifyDialog,
    handleSubmitCode,
    handleSubmit2fa,
  };
}
