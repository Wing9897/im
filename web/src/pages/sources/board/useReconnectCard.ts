import { useCallback, useRef, useState } from "react";
import { reconnectSource } from "../../../api/sources";
import i18n from "../../../i18n";
import { toErrorMessage } from "../../../utils/errors";

interface UseReconnectCardOptions {
  sourceId: string;
  onReconnectSuccess: () => void;
}

interface UseReconnectCardReturn {
  reconnecting: boolean;
  reconnectError: string | null;
  handleReconnect: () => void;
}

export function useReconnectCard({
  sourceId,
  onReconnectSuccess,
}: UseReconnectCardOptions): UseReconnectCardReturn {
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const reconnectingRef = useRef(false);

  const handleReconnect = useCallback(() => {
    if (reconnectingRef.current) return;
    reconnectingRef.current = true;
    setReconnecting(true);
    setReconnectError(null);
    void (async () => {
      try {
        const resp = await reconnectSource(sourceId);
        if (resp.nextStep === "connected") {
          onReconnectSuccess();
        } else {
          setReconnectError(String(i18n.t("sources:errors.reconnectFailed")));
        }
      } catch (e) {
        setReconnectError(toErrorMessage(e));
      } finally {
        reconnectingRef.current = false;
        setReconnecting(false);
      }
    })();
  }, [sourceId, onReconnectSuccess]);

  return { reconnecting, reconnectError, handleReconnect };
}
