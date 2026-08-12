export type PanelSpineVariant = "event" | "live";

export const mapContainerClass = "relative flex h-full flex-1 flex-col";

export const mapStageClass =
  "relative flex min-h-0 flex-[1_1_0] max-h-[calc(100vh-200px)] overflow-hidden";

export const mapStageFullscreenClass =
  "relative flex min-h-0 flex-[1_1_0] overflow-hidden";

export const mapLeafletFillClass = "h-full w-full";

export const mapResetViewBtnClass =
  "im-surface-panel absolute bottom-7 right-2.5 z-[1100] flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-surface-border text-base leading-none text-text-secondary transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary";

export const mapPopupBodyClass = "text-body text-text-primary";

export const mapPopupSubtextClass = "mt-1 text-xs text-text-subtle";

export const mapEmptyOverlayClass =
  "pointer-events-none absolute inset-0 z-[1000] flex items-center justify-center";

export const mapEmptyMsgClass =
  "im-surface-panel pointer-events-auto rounded-lg border border-surface-border px-lg py-lg text-sm text-text-secondary";

export const mapDetailPanelClass =
  "im-map-overlay-panel absolute right-3 top-3 z-[1100] flex max-h-[calc(100%-24px)] w-[340px] flex-col overflow-hidden";

export const mapClusterListClass =
  "im-map-overlay-panel absolute right-3 top-3 z-[1100] flex max-h-[240px] w-[320px] flex-col overflow-hidden";

export const mapDetailCloseClass =
  "absolute right-2.5 top-2 z-[3] flex min-h-6 min-w-6 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-1 text-lg leading-none text-text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary";

export const mapEventPanelBodyClass =
  "danmaku-body-hide-scrollbar relative flex-1 overflow-y-auto p-lg";

export const mapEventPanelBodyFlushClass =
  "danmaku-body-hide-scrollbar relative flex-1 overflow-y-auto p-0";

export const mapClusterHeaderClass =
  "flex items-center justify-between border-b border-surface-border px-md py-sm text-caption font-semibold text-text-primary";

export const mapClusterItemClass =
  "im-map-cluster-item cursor-pointer border-b border-[color-mix(in_srgb,var(--surface-border)_15%,transparent)] px-md py-1.5 transition-[background] duration-100";

export const mapClusterItemTitleClass =
  "mb-0.5 truncate text-caption font-semibold text-text-primary";

export const mapClusterItemMetaClass = "text-card-meta text-text-muted";

const mapPanelSpineBaseClass = "im-map-panel-spine";

export function mapPanelSpineClass(variant: PanelSpineVariant, hovered: boolean): string {
  return [
    mapPanelSpineBaseClass,
    variant === "event" ? "im-map-panel-spine--event" : "im-map-panel-spine--live",
    hovered ? "is-hovered" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const mapDanmakuPanelContentRowClass = "flex min-h-0 flex-1 flex-row overflow-hidden";

export const mapDanmakuPanelClass =
  "im-map-danmaku-panel absolute bottom-3 left-3 z-[1050] flex w-[340px] flex-col overflow-hidden";

export const mapLiveInfoPanelClass =
  "im-map-live-info-panel absolute left-3 top-3 z-[1050] flex w-[360px] flex-col overflow-hidden border-none bg-transparent shadow-none backdrop-blur-none";

const mapDanmakuBodyClass = "danmaku-body-hide-scrollbar flex-1 overflow-y-auto py-1.5";

export const mapDanmakuBodyTopResizeClass = `${mapDanmakuBodyClass} pt-xl`;

export const mapDanmakuBodyBottomResizeClass = `${mapDanmakuBodyClass} pb-xl`;

export const mapResizeHandleClass =
  "absolute left-0 right-0 z-[1] flex h-3.5 cursor-ns-resize touch-none items-center justify-center";

export const mapResizeHandleGripClass = "h-[3px] w-[38px] rounded-full bg-white/30";

export const mapDanmakuItemClass = "px-md py-1.5";

export const mapLiveInfoItemClass = "px-2.5 py-1";

export const mapDanmakuTitleClass =
  "mb-px truncate text-card-meta font-semibold text-accent-pink";

export const mapDanmakuContentClass =
  "max-h-[2.7em] overflow-hidden text-card-meta leading-[1.35] text-text-secondary";

export const mapEventDetailTitleClass =
  "mb-1.5 break-words pr-lg text-xs font-semibold leading-snug text-text-primary";

export const mapEventDetailContentClass =
  "im-surface-inset mb-sm break-words rounded-lg border border-[color-mix(in_srgb,var(--surface-border)_88%,transparent)] px-sm py-1.5 text-card-meta leading-normal text-text-secondary";

export const mapEventDetailMetaClass =
  "flex flex-col gap-0.5 overflow-hidden text-card-meta text-text-muted";

export const mapEventDetailMetaRowClass = "flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap";

export const mapDetailBackBtnClass =
  "im-text-link-btn flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 pb-1.5 text-caption font-semibold text-accent";

export const mapLiveInfoTitleClass =
  "mb-px truncate text-card-meta font-semibold text-text-primary [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]";

export const mapLiveInfoContentClass =
  "max-h-[3.6em] overflow-hidden text-card-meta leading-[1.2] text-text-secondary [text-shadow:0_1px_2px_rgba(0,0,0,0.45)]";

export const mapTransientContainerClass =
  "pointer-events-none absolute bottom-3 left-3 z-[1050] flex max-w-[340px] flex-col gap-1";

export const mapLiveInfoTransientContainerClass =
  "pointer-events-none absolute left-3 top-3 z-[1050] flex max-w-[360px] flex-col gap-1";

export const mapTransientItemClass =
  "im-surface-panel danmaku-transient rounded-lg border-l-[3px] border-l-accent-pink px-md py-1.5";

export const mapLiveInfoTransientItemClass =
  "im-surface-panel danmaku-transient rounded-lg border-l-2 border-l-[rgba(245,224,220,0.45)] px-2.5 py-1";

export const mapTransientPanelRowClass =
  "pointer-events-none flex flex-row items-stretch gap-0";

export const mapTransientItemsColumnClass = "flex min-w-0 flex-1 flex-col gap-1";

export const mapBottomBarClass =
  "im-surface-chrome shrink-0 border-t border-surface-border";

export const mapSmallBtnClass =
  "cursor-pointer whitespace-nowrap rounded-md border border-surface-border bg-transparent px-2.5 py-1 text-caption font-medium text-text-secondary transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--surface-overlay)_60%,transparent)] hover:text-text-primary";

const mapSmallBtnActiveClass =
  "border-[var(--accent-pink)] text-[var(--accent-pink)]";

const mapSmallBtnMutedClass = "border-surface-border text-text-muted";

/** LIVE±Nh MenuSelect trigger — match overlay buttons, override form-chrome h-8/card bg. */
export const mapSmallSelectClass = `${mapSmallBtnClass} !h-auto !min-h-0 !max-h-none !bg-transparent pr-7`;

export function overlayButtonClass(active: boolean): string {
  return [mapSmallBtnClass, active ? mapSmallBtnActiveClass : mapSmallBtnMutedClass].join(" ");
}
