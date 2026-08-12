import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";

type ToastTone = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
export { ToastContext };

const TOAST_DURATION = 4000;

interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, tone: ToastTone = "info") => {
    const id = String(++idCounter.current);
    setToasts((current) => [...current, { id, message, tone }]);

    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      removeToast(id);
    }, TOAST_DURATION);
    timersRef.current.add(timer);
  }, [removeToast]);

  const contextValue = useMemo<ToastContextValue>(
    () => ({ showToast }),
    [showToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="pointer-events-none fixed bottom-2xl right-2xl z-[2000] flex max-w-[360px] flex-col gap-md"
    >
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          stackIndex={index}
          onRemove={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
}

const toneBorderClass: Record<ToastTone, string> = {
  success: "border-success",
  error: "border-error",
  info: "border-info",
  warning: "border-warning",
};

const toneBadgeClass: Record<ToastTone, string> = {
  success: "bg-success",
  error: "bg-error",
  info: "bg-info",
  warning: "bg-warning",
};

const toneIcons: Record<ToastTone, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

function ToastItem({
  toast,
  stackIndex,
  onRemove,
}: {
  toast: Toast;
  stackIndex: number;
  onRemove: () => void;
}) {
  return (
    <div
      className={[
        "im-toast-in im-surface-panel pointer-events-auto flex cursor-pointer items-start gap-md rounded-[10px] border px-lg py-md shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
        toneBorderClass[toast.tone],
      ].join(" ")}
      style={{ marginTop: stackIndex > 0 ? 4 : undefined }}
      onClick={onRemove}
    >
      <span
        className={[
          "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-surface-base",
          toneBadgeClass[toast.tone],
        ].join(" ")}
      >
        {toneIcons[toast.tone]}
      </span>
      <div className="flex-1 whitespace-pre-wrap break-words text-body leading-normal text-text-primary">
        {toast.message}
      </div>
    </div>
  );
}
