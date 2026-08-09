import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { Message } from "../../../types";
import i18n from "../../../i18n";
import { useDeepLinkFingerprint } from "../../../hooks/useDeepLinkFingerprint";
import { useReplaceSearchParams } from "../../../hooks/useReplaceSearchParams";
import { useToast } from "../../../context/ToastContext";

interface UseMonitorSelectionUrlOptions {
  selectedId: string | null;
  messages: readonly Message[];
  onHydrate: (message: Message) => void;
  /**
   * True when the current list page is settled and no further pages exist.
   * Miss toast must wait for this — otherwise a deep-link on page 2+ false-fires.
   */
  listExhausted: boolean;
  /** True while initial load / refresh / load-more is in flight. */
  listBusy: boolean;
}

/**
 * Syncs open message detail with `?id=`.
 *
 * INVARIANTS:
 * - Hydrate only when the message is already in the loaded list (no single-get API).
 * - Miss toast waits for `listExhausted` — otherwise page-2+ deep-links false-fire.
 * - Re-apply per `location.key` fingerprint so keep-mount second deep-links work;
 *   do not “apply once forever” without clear-on-null fingerprint.
 * Regression fences: `useMonitorSelectionUrl.test.ts`, `useDeepLinkFingerprint` tests.
 */
export function useMonitorSelectionUrl({
  selectedId,
  messages,
  onHydrate,
  listExhausted,
  listBusy,
}: UseMonitorSelectionUrlOptions) {
  const location = useLocation();
  const replaceParams = useReplaceSearchParams();
  const { showToast } = useToast();
  const deepLinkGate = useDeepLinkFingerprint();
  /** True after the first hydrate pass so state→URL sync may run. */
  const hydratedRef = useRef(false);
  const pendingIdRef = useRef<string | null>(null);
  /** Avoid repeat onHydrate while waiting for selectedId to catch up. */
  const notifiedPendingRef = useRef<string | null>(null);
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onHydrateRef = useRef(onHydrate);
  onHydrateRef.current = onHydrate;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    const id = new URLSearchParams(location.search).get("id");
    const gate = deepLinkGate(location.key, id);
    if (gate === "clear") {
      // No pending signal — allow a future ?id= to apply.
      pendingIdRef.current = null;
      notifiedPendingRef.current = null;
      hydratedRef.current = true;
      return;
    }
    if (gate === "skip") {
      hydratedRef.current = true;
      return;
    }

    // Already showing this message (e.g. our own state→URL sync) — do not re-queue.
    if (id === selectedIdRef.current) {
      pendingIdRef.current = null;
      notifiedPendingRef.current = null;
      hydratedRef.current = true;
      return;
    }

    pendingIdRef.current = id;
    notifiedPendingRef.current = null;
    hydratedRef.current = true;
  }, [deepLinkGate, location.key, location.search]);

  useEffect(() => {
    const pendingId = pendingIdRef.current;
    if (!pendingId) return;

    // Keep pending until selectedId matches so sync does not clobber a new ?id=
    // with a stale selectedId (and does not wipe ?id= before selectedId commits).
    if (selectedId === pendingId) {
      pendingIdRef.current = null;
      notifiedPendingRef.current = null;
      return;
    }

    if (notifiedPendingRef.current === pendingId) return;

    const found = messages.find((message) => message.id === pendingId);
    if (found) {
      notifiedPendingRef.current = pendingId;
      onHydrateRef.current(found);
      return;
    }
    // Keep waiting while loading / more pages may still contain the id.
    if (listBusy || !listExhausted || messages.length === 0) return;

    // List fully exhausted and id missing — clear URL and notify.
    pendingIdRef.current = null;
    notifiedPendingRef.current = null;
    replaceParams((params) => {
      params.delete("id");
    });
    showToastRef.current(String(i18n.t("monitor:message.notFound")), "warning");
  }, [listBusy, listExhausted, location.key, messages, replaceParams, selectedId]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    // Deep-link hydrate owns `?id=` until selectedId catches up.
    if (pendingIdRef.current) return;

    const currentId = new URLSearchParams(location.search).get("id");
    if (selectedId) {
      if (currentId === selectedId) return;
      replaceParams((params) => {
        params.set("id", selectedId);
      });
      return;
    }
    if (currentId == null) return;
    replaceParams((params) => {
      params.delete("id");
    });
  }, [location.search, replaceParams, selectedId]);
}
