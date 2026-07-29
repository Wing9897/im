/**
 * Thin ErrorToast adapter — subscribes to `errorToastEmitter` and renders
 * structured ErrorToast cards (correlation id / actions).
 *
 * Intended primarily for collector SSE / opt-in structured emits. Ordinary
 * list-load and command failures use the shared ToastProvider. Do not broaden
 * this structured path beyond collector SSE / opt-in emits.
 *
 * Requirements: 10.2, 11.1
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ErrorToast } from "../components/ErrorToast";
import { errorToastEmitter, type ErrorToastEvent } from "../api/errorToastEmitter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToastEntry {
  id: string;
  message: string;
  errorCode: string;
  correlationId: string;
}

interface ErrorToastContextValue {
  /** Programmatically show an error toast */
  showErrorToast: (event: ErrorToastEvent) => void;
  /** Dismiss a specific toast by id */
  dismissToast: (id: string) => void;
  /** Dismiss all toasts */
  dismissAllToasts: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ErrorToastContext = createContext<ErrorToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Auto-dismiss timeout in milliseconds (15 seconds) */
const AUTO_DISMISS_MS = 15_000;

/** Maximum number of toasts shown at once */
const MAX_TOASTS = 5;

interface ErrorToastProviderProps {
  children: ReactNode;
  /** Optional navigation handler for action buttons (e.g., React Router navigate) */
  onNavigate?: (path: string) => void;
}

let nextToastId = 0;
function generateToastId(): string {
  return `toast-${Date.now()}-${++nextToastId}`;
}

export function ErrorToastProvider({ children, onNavigate }: ErrorToastProviderProps) {
  const { t } = useTranslation("common");
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Dismiss a single toast
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  // Dismiss all toasts
  const dismissAllToasts = useCallback(() => {
    setToasts([]);
    for (const timer of timersRef.current.values()) {
      clearTimeout(timer);
    }
    timersRef.current.clear();
  }, []);

  // Show a new error toast
  const showErrorToast = useCallback((event: ErrorToastEvent) => {
    const id = generateToastId();
    const entry: ToastEntry = {
      id,
      message: event.message,
      errorCode: event.errorCode,
      correlationId: event.correlationId,
    };

    setToasts((prev) => {
      // Limit toast count — remove oldest if at max
      const next = [...prev, entry];
      if (next.length > MAX_TOASTS) {
        const removed = next.shift();
        if (removed) {
          const timer = timersRef.current.get(removed.id);
          if (timer) {
            clearTimeout(timer);
            timersRef.current.delete(removed.id);
          }
        }
      }
      return next;
    });

    // Auto-dismiss after timeout
    const timer = setTimeout(() => {
      dismissToast(id);
    }, AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
  }, [dismissToast]);

  // Subscribe to the errorToastEmitter (API client errors)
  useEffect(() => {
    const unsubscribe = errorToastEmitter.on((event) => {
      showErrorToast(event);
    });
    return unsubscribe;
  }, [showErrorToast]);

  // Cleanup all timers on unmount
  useEffect(() => {
    // The Map instance is never reassigned, so capturing it here keeps the
    // cleanup in sync with every timer added during the component's lifetime.
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const contextValue = useMemo<ErrorToastContextValue>(
    () => ({ showErrorToast, dismissToast, dismissAllToasts }),
    [showErrorToast, dismissToast, dismissAllToasts],
  );

  return (
    <ErrorToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container — fixed position bottom-right */}
      {toasts.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            pointerEvents: "none",
          }}
          aria-label={t("errorToast.regionAria")}
        >
          {toasts.map((toast) => (
            <ErrorToast
              key={toast.id}
              message={toast.message}
              errorCode={toast.errorCode}
              correlationId={toast.correlationId}
              onDismiss={() => dismissToast(toast.id)}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </ErrorToastContext.Provider>
  );
}
