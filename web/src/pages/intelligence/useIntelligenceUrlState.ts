import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import type { ViewMode } from "../../types";
import { useDeepLinkFingerprint } from "../../hooks/useDeepLinkFingerprint";
import { useReplaceSearchParams } from "../../hooks/useReplaceSearchParams";

function isViewMode(value: string | null): value is ViewMode {
  return value === "card" || value === "list" || value === "map";
}

interface UseIntelligenceUrlStateOptions {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  search: string;
  setSearch: (value: string) => void;
  selectedId: string | null;
  /** False while a URL `id` is still being resolved from loaded items. */
  allowClearSelectedId?: boolean;
  onSelectedIdFromUrl: (id: string | null) => void;
}

/**
 * Syncs Intelligence view/search/selected id with URL:
 * `/intelligence?view=map&q=...&id=...`
 * Deep-links re-apply per `location.key` fingerprint (keep-mount safe);
 * thereafter state drives the query string.
 */
export function useIntelligenceUrlState({
  viewMode,
  setViewMode,
  search,
  setSearch,
  selectedId,
  allowClearSelectedId = true,
  onSelectedIdFromUrl,
}: UseIntelligenceUrlStateOptions) {
  const location = useLocation();
  const replaceParams = useReplaceSearchParams();
  const deepLinkGate = useDeepLinkFingerprint();
  /** True after the first hydrate pass so state→URL sync may run. */
  const hydratedRef = useRef(false);
  const skipSyncRef = useRef(false);
  const expectedViewRef = useRef<ViewMode | null>(null);
  const expectedSearchRef = useRef<string | null>(null);
  const expectedIdRef = useRef<string | null>(null);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;
  const searchRef = useRef(search);
  searchRef.current = search;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const onSelectedIdFromUrlRef = useRef(onSelectedIdFromUrl);
  onSelectedIdFromUrlRef.current = onSelectedIdFromUrl;

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const view = searchParams.get("view");
    const hasQ = searchParams.has("q");
    const q = hasQ ? (searchParams.get("q") ?? "") : null;
    const id = searchParams.get("id");
    const hasPayload = isViewMode(view) || hasQ || Boolean(id);

    const payload = hasPayload
      ? `${isViewMode(view) ? view : ""}:${hasQ ? `q=${q}` : ""}:${id ?? ""}`
      : null;
    const gate = deepLinkGate(location.key, payload);
    if (gate === "clear") {
      hydratedRef.current = true;
      return;
    }
    if (gate === "skip") {
      hydratedRef.current = true;
      return;
    }

    let shouldSkip = false;

    if (isViewMode(view) && view !== viewModeRef.current) {
      expectedViewRef.current = view;
      setViewMode(view);
      shouldSkip = true;
    }

    if (hasQ && q != null && q !== searchRef.current) {
      expectedSearchRef.current = q;
      setSearch(q);
      shouldSkip = true;
    }

    if (id && id !== selectedIdRef.current) {
      expectedIdRef.current = id;
      onSelectedIdFromUrlRef.current(id);
      shouldSkip = true;
    }

    skipSyncRef.current = shouldSkip;
    hydratedRef.current = true;
  }, [deepLinkGate, location.key, location.search, setSearch, setViewMode]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    if (skipSyncRef.current) {
      const viewPending =
        expectedViewRef.current != null && viewMode !== expectedViewRef.current;
      const searchPending =
        expectedSearchRef.current != null && search !== expectedSearchRef.current;
      const idPending =
        expectedIdRef.current != null && selectedId !== expectedIdRef.current;
      if (viewPending || searchPending || idPending) return;
      skipSyncRef.current = false;
      expectedViewRef.current = null;
      expectedSearchRef.current = null;
      expectedIdRef.current = null;
    }

    replaceParams((params) => {
      params.set("view", viewMode);
      const trimmed = search.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      if (selectedId) params.set("id", selectedId);
      else if (allowClearSelectedId) params.delete("id");
    });
  }, [allowClearSelectedId, replaceParams, search, selectedId, viewMode]);
}
