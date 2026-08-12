import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import { AlertBanner, Button, FormActions } from "../../../components/ui";
import { useFocusTrap } from "../../../hooks/useFocusTrap";
import { OverlayPortal } from "../../../components/common/OverlayPortal";
import { compactSourceDialogShellClass } from "../../../components/dialogs/dialogShellClasses";

/** Quiet-zone modules for qrcode.toDataURL (not CSS spacing). */
const QR_CODE_MARGIN_MODULES = 2;

interface QrLoginDialogProps {
  qrUrl: string | null;
  qrExpiresAt: string | null;
  waiting: boolean;
  error: string | null;
  onClose: () => void;
}

export function QrLoginDialog({
  qrUrl,
  qrExpiresAt,
  waiting,
  error,
  onClose,
}: QrLoginDialogProps) {
  const { t } = useTranslation("sources");
  const focusTrapRef = useFocusTrap({ active: true, onEscape: onClose });
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!qrUrl) {
      setDataUrl(null);
      return;
    }
    setQrError(null);
    void QRCode.toDataURL(qrUrl, {
      width: 240,
      margin: QR_CODE_MARGIN_MODULES,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setQrError(String(t("verify.qrRenderFailed")));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrUrl, t]);

  const expiresLabel = qrExpiresAt
    ? new Date(qrExpiresAt).toLocaleTimeString()
    : null;

  return (
    <OverlayPortal onOverlayClick={onClose} lockBodyScroll>
      <div
        ref={focusTrapRef}
        className={`${compactSourceDialogShellClass} im-animate-in-scale`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-md text-base font-semibold text-text-primary">
          {t("verify.qrTitle")}
        </h2>
        <p className="mb-md text-body text-text-secondary">{t("verify.qrHint")}</p>
        {error || qrError ? (
          <AlertBanner variant="error" role="alert" className="mb-sm">
            {error || qrError}
          </AlertBanner>
        ) : null}
        <div className="mb-md flex flex-col items-center gap-sm">
          {dataUrl ? (
            <img
              src={dataUrl}
              alt={t("verify.qrAlt")}
              className="h-[240px] w-[240px] rounded-md bg-white p-sm"
            />
          ) : (
            <div className="im-surface-inset flex h-[240px] w-[240px] items-center justify-center rounded-md border border-surface-border text-body text-text-muted">
              {t("verify.qrLoading")}
            </div>
          )}
          {expiresLabel ? (
            <p className="text-xs text-text-muted">
              {t("verify.qrExpires", { time: expiresLabel })}
            </p>
          ) : null}
          {waiting ? (
            <p className="text-center text-xs text-text-muted">{t("verify.qrWaiting")}</p>
          ) : null}
        </div>
        <FormActions inline className="mt-md">
          <Button variant="secondary" onClick={onClose}>
            {t("shared.cancel")}
          </Button>
        </FormActions>
      </div>
    </OverlayPortal>
  );
}
