import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

import i18n from "../i18n";
import { Button } from "./ui";

// --- Types ---

interface ErrorToastProps {
  message: string;
  errorCode: string;
  correlationId: string;
  onDismiss: () => void;
  onNavigate?: (path: string) => void;
}

interface ToastAction {
  label: string;
  action: () => void | Promise<void>;
}

/** Account → Access keys (Webhook / automation). */
export const ACCOUNT_ACCESS_KEYS_PATH = "/account/keys";

// --- Helpers ---

/** Returns the first 8 characters of a correlation ID for display. */
export function formatCorrelationRef(correlationId: string): string {
  return correlationId.substring(0, 8);
}

/** Determines the action buttons to display based on error code. */
export function getActionsForErrorCode(
  errorCode: string,
  handlers: { navigateToAccountAccessKeys: () => void },
): ToastAction[] {
  switch (errorCode) {
    case "AUTH_REQUIRED":
    case "AUTH_SETUP_REQUIRED":
      return [
        {
          label: String(i18n.t("common:errorToast.goAccountAccessKeys")),
          action: handlers.navigateToAccountAccessKeys,
        },
      ];
    case "FORBIDDEN":
    case "COLLECTOR_UNAVAILABLE":
    case "SSE_CAPACITY":
    default:
      return [];
  }
}

// --- Component ---

export function ErrorToast({
  message,
  errorCode,
  correlationId,
  onDismiss,
  onNavigate,
}: ErrorToastProps) {
  const { t } = useTranslation("common");
  const handleNavigateToAccountAccessKeys = useCallback(() => {
    if (onNavigate) {
      onNavigate(ACCOUNT_ACCESS_KEYS_PATH);
    }
    onDismiss();
  }, [onDismiss, onNavigate]);

  const actions = getActionsForErrorCode(errorCode, {
    navigateToAccountAccessKeys: handleNavigateToAccountAccessKeys,
  });

  const correlationRef = formatCorrelationRef(correlationId);

  return (
    <div
      className="animate-[toast-in_0.3s_ease-out_forwards] pointer-events-auto relative flex max-w-[380px] flex-col gap-sm rounded-md border border-error bg-surface-card p-md shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
      role="alert"
      aria-live="assertive"
      data-testid="error-toast"
    >
      <div className="flex items-start justify-between gap-sm">
        <div className="flex-1">
          <div className="whitespace-pre-wrap break-words text-sm leading-normal text-text-primary">
            {message}
          </div>
          <div className="font-mono text-[11px] text-text-muted" data-testid="error-toast-ref">
            Ref: {correlationRef}
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-0 text-text-secondary transition-colors hover:text-text-primary"
          onClick={onDismiss}
          aria-label={t("errorToast.closeAria")}
          data-testid="error-toast-close"
        >
          <X size={14} />
        </button>
      </div>

      {actions.length > 0 ? (
        <div className="mt-xs flex items-center gap-sm">
          {actions.map((toastAction) => (
            <Button
              key={toastAction.label}
              variant="danger"
              size="sm"
              onClick={() => void toastAction.action()}
              data-testid={`error-toast-action-${errorCode}`}
            >
              {toastAction.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
