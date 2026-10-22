import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { SourceDrawer } from "./SourceDrawer";
import { notifySourceDrawerClosed } from "../../domain/sources/sourceDrawerEvents";
import { withReturnTo } from "../../routing/returnTo";
import { SourceManagementPage } from "./SourceManagementPage";

const WEBHOOK_FORM_PATH = "/sources?tab=http&mode=webhook";

/** Drop drawer-only keys. Page `tab` / `mode` stay so other screens keep their own query. */
export function withoutSourceDrawerParams(prev: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(prev);
  next.delete("source");
  next.delete("sourceTab");
  next.delete("sourceMode");
  return next;
}

/** Current location with the create-source drawer query removed. */
export function pathWithoutSourceDrawer(pathname: string, search: string, hash = ""): string {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = withoutSourceDrawerParams(new URLSearchParams(raw));
  const qs = params.toString();
  return `${pathname}${qs ? `?${qs}` : ""}${hash}`;
}

/**
 * App-level create-source drawer (`?source=new`).
 * Platform and HTTP mode use `sourceTab` / `sourceMode`.
 * Webhook opens the sources page with `returnTo` and leaves the current page in history.
 */
export function SourceDrawerHost() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const onSourcesPage = location.pathname === "/sources";
  const sourceParamIsNew = searchParams.get("source") === "new";
  const webhookInDrawer =
    searchParams.get("sourceTab") === "http" && searchParams.get("sourceMode") === "webhook";
  const open = sourceParamIsNew && !onSourcesPage && !webhookInDrawer;
  const wasOpen = useRef(false);
  const webhookRedirected = useRef(false);
  const close = useCallback(() => {
    setSearchParams((prev) => withoutSourceDrawerParams(prev), { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (wasOpen.current && !open) notifySourceDrawerClosed();
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!sourceParamIsNew) {
      webhookRedirected.current = false;
      return;
    }
    if (onSourcesPage) {
      close();
      return;
    }
    if (!webhookInDrawer || webhookRedirected.current) return;
    webhookRedirected.current = true;
    const back = pathWithoutSourceDrawer(location.pathname, location.search, location.hash);
    // Keep this page in history, but drop the webhook trigger so Back does not bounce.
    navigate(back, { replace: true });
    navigate(withReturnTo(WEBHOOK_FORM_PATH, back));
  }, [
    close,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    onSourcesPage,
    sourceParamIsNew,
    webhookInDrawer,
  ]);

  if (!open) return null;

  return (
    <SourceDrawer open onClose={close}>
      <SourceManagementPage embedded />
    </SourceDrawer>
  );
}
