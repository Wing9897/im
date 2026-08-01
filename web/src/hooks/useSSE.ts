import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient, type SseConnection, type SseEvent } from "../api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SSEConnectionStatus = "connected" | "connecting" | "disconnected" | "reconnecting";

export interface UseSSEOptions {
  onEvent: (event: SseEvent) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
}

interface UseSSEReturn {
  status: SSEConnectionStatus;
  disconnect: () => void;
  reconnect: () => void;
}

// ---------------------------------------------------------------------------
// Hook Implementation
// ---------------------------------------------------------------------------

/**
 * React hook that manages an SSE connection to the backend events endpoint.
 *
 * - Connects to SSE on mount (when `enabled` is true), disconnects on unmount
 * - Parses incoming events and forwards them to the `onEvent` callback
 * - The `connectSSE()` method already handles auto-reconnect (5s delay) internally
 * - Returns connection status (connected/disconnected/reconnecting)
 *
 * @example
 * ```tsx
 * const { status } = useSSE({
 *   onEvent: (event) => {
 *     if (event.event === 'messages_updated') {
 *       // dispatch to messages context
 *     }
 *   },
 * });
 * ```
 */
export function useSSE(options: UseSSEOptions): UseSSEReturn {
  const { onEvent, onError, enabled = true } = options;

  const [status, setStatus] = useState<SSEConnectionStatus>("disconnected");
  const connectionRef = useRef<SseConnection | null>(null);
  const manuallyDisconnectedRef = useRef(false);

  // Use refs for callbacks to avoid re-connecting when callbacks change
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }

    manuallyDisconnectedRef.current = false;
    setStatus("connecting");

    connectionRef.current = apiClient.connectSSE(
      (event: SseEvent) => {
        // Once we receive an event, we know the connection is established
        setStatus("connected");
        onEventRef.current(event);
      },
      {
        // Fires for the initial open and for every reconnect, so a recovered
        // session leaves "reconnecting" without waiting for the next event.
        onOpen: () => {
          setStatus("connected");
        },
        onError: (error: Event) => {
          // The connectSSE method handles auto-reconnect internally.
          // Here we just update status and forward the error.
          if (!manuallyDisconnectedRef.current) {
            setStatus("reconnecting");
          }
          onErrorRef.current?.(error);
        },
      },
    );
  }, []);

  const disconnect = useCallback(() => {
    manuallyDisconnectedRef.current = true;
    if (connectionRef.current) {
      connectionRef.current.close();
      connectionRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  // Connect on mount / when enabled changes, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      // Cleanup: close the SSE session when unmounting
      if (connectionRef.current) {
        connectionRef.current.close();
        connectionRef.current = null;
      }
    };
  }, [enabled, connect, disconnect]);

  return { status, disconnect, reconnect };
}
