/**
 * Bridge SSE ``resource_modified`` to in-app listeners (task catalog / timeline).
 * Backend already publishes this for REST CRUD; agent calendar writes now do too.
 */

export const RESOURCE_MODIFIED_EVENT = "im:resource-modified";

export type ResourceModifiedDetail = {
  resourceType: string;
  resourceId: string;
  action: string;
};

export function emitResourceModified(detail: ResourceModifiedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RESOURCE_MODIFIED_EVENT, { detail }));
}

export function subscribeResourceModified(
  handler: (detail: ResourceModifiedDetail) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<ResourceModifiedDetail>).detail;
    if (!detail || typeof detail !== "object") return;
    if (typeof detail.resourceType !== "string" || typeof detail.resourceId !== "string") {
      return;
    }
    handler(detail);
  };
  window.addEventListener(RESOURCE_MODIFIED_EVENT, listener);
  return () => window.removeEventListener(RESOURCE_MODIFIED_EVENT, listener);
}
