import { useContext, useEffect, useRef } from "react";

import { ToastContext } from "../context/ToastContext";

/**
 * Surface a transient page/action error without inserting UI into the layout.
 * Repeated renders of the same error only produce one notification.
 */
export function useErrorToast(error: string | null | undefined, prefix?: string) {
  const toastContext = useContext(ToastContext);
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error) {
      lastErrorRef.current = null;
      return;
    }
    if (lastErrorRef.current === error) return;

    lastErrorRef.current = error;
    toastContext?.showToast(prefix ? `${prefix}${error}` : error, "error");
  }, [error, prefix, toastContext]);
}
