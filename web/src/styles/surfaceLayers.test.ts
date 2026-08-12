/**
 * Surface layer tokens — photo BG (custom / focal) glass system.
 * Ensures chrome / panel / inset layers stay wired for visual regression.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { controlBaseClass } from "../components/ui/controlStyles";
import {
  pageChromeOuterClass,
  pageShellGridClass,
  stickyChromePageFillClass,
} from "../components/ui/pageChrome";
import {
  compactSourceDialogShellClass,
  dialogShellClass,
} from "../components/dialogs/dialogShellClasses";
import {
  detailDialogDrawerShellClass,
  detailDialogModalShellClass,
  detailDialogScrollBodyClass,
} from "../components/detail/classes/shell";
import {
  segmentedTrackClass,
  segmentedTrackInlineClass,
} from "../components/ui/segmentedTabStyles";
import {
  itemFormPageFillClass,
  itemsPageFillClass,
} from "../pages/items/itemsPageChromeClasses";
import {
  sourceBoardClass,
  sourceBoardFormClass,
  sourceBoardListClass,
} from "../pages/sources/board/sourceBoardClasses";

const here = dirname(fileURLToPath(import.meta.url));
const surfaceCss = readFileSync(resolve(here, "../css/surface-materials.css"), "utf8");
const themeCss = readFileSync(resolve(here, "../theme.css"), "utf8");
const themeGeneratedCss = readFileSync(resolve(here, "../theme.generated.css"), "utf8");
const texturesCss = readFileSync(resolve(here, "../css/theme-textures.css"), "utf8");
const layoutCss = readFileSync(resolve(here, "../css/shared-layout.css"), "utf8");
const motionCss = readFileSync(resolve(here, "../css/motion-utilities.css"), "utf8");
const indexHtml = readFileSync(resolve(here, "../../index.html"), "utf8");
const menuSelectSrc = readFileSync(
  resolve(here, "../components/ui/MenuSelect.tsx"),
  "utf8",
);
const linkedCalSrc = readFileSync(
  resolve(here, "../pages/items/form/ItemFormLinkedCalendarsSection.tsx"),
  "utf8",
);
const feedCardSrc = readFileSync(resolve(here, "../components/ui/FeedCard.tsx"), "utf8");
const sourceListSectionSrc = readFileSync(
  resolve(here, "../pages/sources/board/SourceListSection.tsx"),
  "utf8",
);
const panelSectionSrc = readFileSync(
  resolve(here, "../components/ui/PanelSection.tsx"),
  "utf8",
);
const timelineEventCardSrc = readFileSync(
  resolve(here, "../pages/timeline/components/timelineEventCardClasses.ts"),
  "utf8",
);
const calendarCellSrc = readFileSync(
  resolve(here, "../pages/timeline/calendar/calendarCellClasses.ts"),
  "utf8",
);
const scheduleEventCardSrc = readFileSync(
  resolve(here, "../pages/schedule/ScheduleEventCard.tsx"),
  "utf8",
);
const statsStripSrc = readFileSync(resolve(here, "../components/ui/StatsStrip.tsx"), "utf8");

/** Opening ``<CollapsePanel …>`` tags — skip ``=>`` so multiline props parse correctly. */
function collapsePanelOpenTags(src: string): string[] {
  const out: string[] = [];
  let idx = 0;
  while (true) {
    const start = src.indexOf("<CollapsePanel", idx);
    if (start === -1) break;
    let i = start + "<CollapsePanel".length;
    while (i < src.length) {
      if (src[i] === ">" && src[i - 1] !== "=") {
        out.push(src.slice(start, i + 1));
        idx = i + 1;
        break;
      }
      i += 1;
    }
    if (i >= src.length) break;
  }
  return out;
}

describe("surface layer tokens", () => {
  it("defines chrome / panel / inset defaults on html", () => {
    expect(themeCss).toContain("--surface-chrome:");
    expect(themeCss).toContain("--surface-panel:");
    expect(themeCss).toContain("--surface-inset:");
    expect(themeCss).toContain("--surface-blur-chrome:");
    expect(themeCss).toContain("--surface-blur-panel:");
  });

  it("softens layers under photo BG modes without forcing glass on none", () => {
    // Token softens must stay unlayered in theme.css — @layer components loses to
    // unlayered html { --surface-panel: var(--surface-card) }, which made resting
    // cards opaque while .im-card-hover:hover hardcoded the only visible glass.
    expect(themeCss).toContain('html[data-theme-bg="custom"]');
    expect(themeCss).toContain('html[data-theme-bg="focal"]');
    expect(themeCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--surface-panel:\s*color-mix/s,
    );
    expect(themeCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--surface-blur-panel:\s*22px/s,
    );
    expect(themeCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--surface-blur-chrome:\s*18px/s,
    );
    expect(themeCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--surface-panel:\s*color-mix\(in srgb, var\(--surface-card\) 63%/s,
    );
    expect(themeCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--surface-chrome:[\s\S]*?70%/s,
    );
    expect(themeCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--surface-inset:\s*color-mix\(in srgb, var\(--surface-card\) 86%/s,
    );
    expect(themeCss).not.toContain("--im-panel-opacity");
    expect(surfaceCss).not.toMatch(
      /html\[data-theme-bg="custom"\][\s\S]*--surface-panel:/,
    );
    expect(surfaceCss).toContain(".im-surface-chrome");
    expect(surfaceCss).toContain(".im-surface-panel");
    expect(surfaceCss).toContain(".im-surface-inset");
    expect(surfaceCss).toContain(".im-page-shell");
    expect(surfaceCss).toContain(".im-material-panel");
    expect(surfaceCss).not.toContain(".im-material-solid");
    expect(surfaceCss).not.toContain(".im-material-glass");
    expect(surfaceCss).toMatch(
      /\.im-material-panel\s*\{[^}]*var\(--surface-panel\)/s,
    );
    expect(surfaceCss).toMatch(
      /\.im-menu-surface\s*\{[^}]*background:\s*var\(--surface-panel\)/s,
    );
    expect(surfaceCss).toMatch(
      /\.im-menu-surface\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-panel\)\)/s,
    );
    // Elevated cards must not clip backdrop-filter (overflow:hidden kills glass over photo BG).
    expect(surfaceCss).toMatch(
      /\.im-material-elevated\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-panel\)\)/s,
    );
    expect(surfaceCss).not.toMatch(
      /\.im-material-elevated\s*\{[^}]*overflow:\s*hidden/s,
    );
    expect(surfaceCss).not.toMatch(
      /\.im-material-elevated\s*\{[^}/]*isolation:\s*isolate/s,
    );
    // Under photo BG, elevated resting fill equals panel (no denser sheen overlay).
    expect(surfaceCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-material-elevated,\s*html\[data-theme-bg="focal"\] \.im-material-elevated\s*\{[^}]*background:\s*var\(--surface-panel\)/s,
    );
    expect(surfaceCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-material-elevated:hover,\s*html\[data-theme-bg="focal"\] \.im-material-elevated:hover\s*\{[^}]*var\(--surface-panel\)/s,
    );
  });

  it("keeps photo canvas / sidebar / app shell free of opaque fill under photo BG", () => {
    expect(surfaceCss).toMatch(
      /\.im-app-shell\s*\{[^}]*background-color:\s*var\(--surface-base\)/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] :is\(\.im-page-canvas, \.im-fs-atmosphere:fullscreen\),\s*html\[data-theme-bg="focal"\] :is\(\.im-page-canvas, \.im-fs-atmosphere:fullscreen\)\s*\{[^}]*background-color:\s*transparent/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-shell-sidebar,\s*html\[data-theme-bg="focal"\] \.im-shell-sidebar\s*\{[^}]*background-color:\s*transparent/s,
    );
    // Sidebar keeps photo plane + chrome frost (denser fill + chrome blur).
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-shell-sidebar,\s*html\[data-theme-bg="focal"\] \.im-shell-sidebar\s*\{[^}]*var\(--surface-chrome\)/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-shell-sidebar,\s*html\[data-theme-bg="focal"\] \.im-shell-sidebar\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-chrome\)\)/s,
    );
    // Photo BG insets get panel blur for calendar cells / inputs.
    expect(surfaceCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-surface-inset,\s*html\[data-theme-bg="focal"\] \.im-surface-inset\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-panel\)\)/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-app-shell,\s*html\[data-theme-bg="focal"\] \.im-app-shell\s*\{[^}]*background-color:\s*transparent/s,
    );
    // Motif film on elevated ::after must pause under photo or glass reads muddy/opaque.
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--texture-opacity:\s*0/s,
    );
  });

  it("paints photo / motif atmosphere onto fullscreen hosts (not only .im-page-canvas)", () => {
    expect(texturesCss).toContain(".im-fs-atmosphere:fullscreen");
    expect(texturesCss).toMatch(
      /html:not\(\[data-theme-bg="custom"\]\):not\(\[data-theme-bg="focal"\]\):not\(\[data-theme-texture="none"\]\) :is\(\.im-page-canvas, \.im-fs-atmosphere:fullscreen\)/,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] :is\(\.im-page-canvas, \.im-fs-atmosphere:fullscreen\)/,
    );
    // Major FS entry points must opt into the shared atmosphere class.
    const timelineSrc = readFileSync(
      resolve(here, "../pages/timeline/TimelinePage.tsx"),
      "utf8",
    );
    const wallSrc = readFileSync(
      resolve(here, "../pages/monitor/components/MonitorWallSection.tsx"),
      "utf8",
    );
    const boardSrc = readFileSync(resolve(here, "../board/BoardRoot.tsx"), "utf8");
    const mapSrc = readFileSync(
      resolve(here, "../pages/intelligence/map/MapView.tsx"),
      "utf8",
    );
    expect(timelineSrc).toContain("im-fs-atmosphere");
    expect(wallSrc).toContain("im-fs-atmosphere");
    expect(boardSrc).toContain("im-fs-atmosphere");
    expect(mapSrc).toContain("im-fs-atmosphere");
    // Map fullscreen must not paint an opaque Tailwind base over the photo plane.
    expect(mapSrc).not.toMatch(/h-screen w-screen[^"\n]*bg-surface-base/);
    const monitorFeedCss = readFileSync(resolve(here, "../css/monitor-feed.css"), "utf8");
    expect(monitorFeedCss).not.toMatch(
      /\.im-wall-fs-host:fullscreen\s*\{[^}]*background:\s*var\(--surface-base\)/s,
    );
  });

  it("does not force opaque raised hover over frosted panels under photo BG", () => {
    expect(layoutCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-card-hover:not\(\.im-material-elevated\):hover,\s*html\[data-theme-bg="focal"\] \.im-card-hover:not\(\.im-material-elevated\):hover\s*\{[^}]*var\(--surface-panel\)/s,
    );
    expect(layoutCss).not.toMatch(
      /html\[data-theme-bg="custom"\] \.im-card-hover:hover[\s\S]{0,200}var\(--surface-raised/s,
    );
  });

  it("photo BG disables enter motion (opacity/transform both flash frosted glass)", () => {
    expect(motionCss).toContain("@keyframes im-enter-rise-photo");
    expect(motionCss).toContain("@keyframes im-enter-rise-soft-photo");
    expect(motionCss).toContain("@keyframes im-enter-glow-photo");
    expect(motionCss).toContain("@keyframes im-fade-in-photo");
    expect(motionCss).toContain("@keyframes im-fade-in-scale-photo");
    // No-op keyframes must not reintroduce transform/filter (breaks backdrop-filter).
    expect(motionCss).toMatch(
      /@keyframes im-fade-in-photo\s*\{[^}]*from\s*\{[^}]*opacity:\s*1[^}]*\}\s*to\s*\{[^}]*opacity:\s*1/s,
    );
    expect(motionCss).not.toMatch(
      /@keyframes im-fade-in-photo\s*\{[^}]*transform:/s,
    );
    expect(motionCss).not.toMatch(
      /@keyframes im-enter-rise-photo\s*\{[^}]*transform:/s,
    );
    expect(motionCss).not.toMatch(
      /@keyframes im-enter-glow-photo\s*\{[^}]*filter:/s,
    );
    expect(motionCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-animate-in,[\s\S]*?html\[data-theme-bg="focal"\]\[data-theme="cyberpunk"\] \.im-enter-rise\s*\{\s*animation:\s*none;/s,
    );
    // shared-layout loads after motion-utilities — must also clear page-root enter.
    expect(layoutCss).toMatch(
      /html\[data-theme-bg="custom"\] \.app-main-content > \*,\s*html\[data-theme-bg="focal"\] \.app-main-content > \*\s*\{\s*animation:\s*none;/s,
    );
  });

  it("wires shell / settings / sources / Items consumers to the layer classes", () => {
    expect(pageChromeOuterClass).toContain("im-surface-chrome");
    expect(pageShellGridClass).toContain("im-page-shell");
    expect(pageShellGridClass).not.toContain("overflow-hidden");
    expect(stickyChromePageFillClass).toContain(pageShellGridClass);
    expect(itemsPageFillClass).toContain(pageShellGridClass);
    expect(itemFormPageFillClass).toContain(pageShellGridClass);
    expect(segmentedTrackClass).toContain("im-surface-chrome");
    expect(segmentedTrackInlineClass).toContain("im-surface-chrome");
    expect(controlBaseClass).toContain("im-surface-inset");
    expect(sourceBoardClass).toContain("im-surface-panel");
    expect(sourceBoardClass).not.toContain("overflow-hidden");
    expect(sourceBoardFormClass).toContain("bg-transparent");
    expect(sourceBoardListClass).toContain("bg-transparent");
    expect(itemsPageFillClass).toContain("im-page-shell");
    expect(itemFormPageFillClass).toContain("im-page-shell");
    expect(itemsPageFillClass).not.toContain("surface-page");
    expect(itemFormPageFillClass).not.toContain("surface-page");
    // Page fill must not overflow-hidden — kills backdrop-filter vs Sources/Schedule.
    expect(itemsPageFillClass).not.toContain("overflow-hidden");
    expect(itemFormPageFillClass).not.toContain("overflow-hidden");
    expect(stickyChromePageFillClass).toContain("im-page-shell");
    expect(stickyChromePageFillClass).not.toContain("overflow-hidden");
    expect(surfaceCss).not.toMatch(
      /\.im-control-bar\s*\{[^}]*overflow:\s*hidden/s,
    );
  });

  it("keeps toast / error / setup / secrets / viewer shells free of opaque bg-surface-card", () => {
    const toastSrc = readFileSync(resolve(here, "../context/ToastContext.tsx"), "utf8");
    const errorToastSrc = readFileSync(resolve(here, "../components/ErrorToast.tsx"), "utf8");
    const errorBoundarySrc = readFileSync(
      resolve(here, "../components/common/ErrorBoundary.tsx"),
      "utf8",
    );
    const pageErrorSrc = readFileSync(
      resolve(here, "../components/common/PageErrorBoundary.tsx"),
      "utf8",
    );
    const lazyErrorSrc = readFileSync(
      resolve(here, "../components/common/LazyLoadErrorBoundary.tsx"),
      "utf8",
    );
    const sectionErrorSrc = readFileSync(
      resolve(here, "../components/common/SectionErrorBoundary.tsx"),
      "utf8",
    );
    const secretsSrc = readFileSync(
      resolve(here, "../components/SecretsBrokenGate.tsx"),
      "utf8",
    );
    const setupSrc = readFileSync(
      resolve(here, "../components/setup/SetupStepIndicator.tsx"),
      "utf8",
    );
    const viewerSrc = readFileSync(resolve(here, "../pages/viewer/ViewerLayout.tsx"), "utf8");
    for (const src of [
      toastSrc,
      errorToastSrc,
      errorBoundarySrc,
      pageErrorSrc,
      lazyErrorSrc,
      sectionErrorSrc,
      secretsSrc,
      setupSrc,
      viewerSrc,
    ]) {
      expect(src).not.toMatch(/bg-surface-card/);
    }
    expect(toastSrc).toContain("im-surface-panel");
    expect(errorToastSrc).toContain("im-surface-panel");
    expect(errorBoundarySrc).toContain("im-surface-panel");
    expect(pageErrorSrc).toContain("im-material-panel");
    expect(lazyErrorSrc).toContain("im-material-panel");
    expect(sectionErrorSrc).toContain("im-surface-panel");
    expect(secretsSrc).toContain("im-material-panel");
    expect(setupSrc).toContain("im-surface-inset");
    expect(viewerSrc).toContain("im-surface-chrome");
  });

  it("unifies compact source dialog shells and keeps detail frost free of overflow-hidden", () => {
    expect(dialogShellClass).toContain("im-material-panel");
    expect(compactSourceDialogShellClass).toContain(dialogShellClass);
    expect(compactSourceDialogShellClass).not.toMatch(/bg-surface-card/);
    const addSourceSrc = readFileSync(
      resolve(here, "../components/dialogs/AddSourceDialog.tsx"),
      "utf8",
    );
    const telegramSrc = readFileSync(
      resolve(here, "../pages/sources/telegram/TelegramSourceDialogs.tsx"),
      "utf8",
    );
    const qrSrc = readFileSync(
      resolve(here, "../pages/sources/telegram/QrLoginDialog.tsx"),
      "utf8",
    );
    expect(addSourceSrc).toContain("compactSourceDialogShellClass");
    expect(telegramSrc).toContain("compactSourceDialogShellClass");
    expect(qrSrc).toContain("compactSourceDialogShellClass");
    expect(detailDialogModalShellClass).toContain("im-material-panel");
    expect(detailDialogModalShellClass).not.toContain("overflow-hidden");
    expect(detailDialogDrawerShellClass).not.toContain("overflow-hidden");
    expect(detailDialogScrollBodyClass).toMatch(/overflow-y-auto/);
  });

  it("does not override SurfaceCard frost with opaque color-mix fills in reset/cleanup panels", () => {
    const runtimeSrc = readFileSync(
      resolve(here, "../components/settings/RuntimeResetPanel.tsx"),
      "utf8",
    );
    const retentionSrc = readFileSync(
      resolve(here, "../components/settings/RetentionCleanupPanel.tsx"),
      "utf8",
    );
    expect(runtimeSrc).not.toMatch(/bg-\[color-mix/);
    expect(retentionSrc).not.toMatch(/bg-\[color-mix/);
    expect(runtimeSrc).not.toMatch(/bg-surface-card/);
    expect(retentionSrc).not.toMatch(/bg-surface-card/);
  });

  it("keeps Theme personalization nested blocks on im-surface-panel (not opaque card fill)", () => {
    const panelSource = readFileSync(
      resolve(here, "../components/settings/ThemePersonalizationPanel.tsx"),
      "utf8",
    );
    expect(panelSource).toContain("im-surface-panel");
    expect(panelSource).toContain("nested");
    expect(panelSource).not.toMatch(
      /theme-color-row[\s\S]{0,200}bg-surface-card/,
    );
  });

  it("Settings CollapsePanels inside SettingsContentCard use nested (no double frost)", () => {
    const generalSrc = readFileSync(
      resolve(here, "../pages/settings/SettingsGeneralPage.tsx"),
      "utf8",
    );
    const mcpDocsSrc = readFileSync(
      resolve(here, "../pages/settings/SettingsMcpDocsSections.tsx"),
      "utf8",
    );
    const advancedSrc = readFileSync(
      resolve(here, "../components/settings/AdvancedSettingsPanel.tsx"),
      "utf8",
    );
    const themeSrc = readFileSync(
      resolve(here, "../components/settings/ThemePersonalizationPanel.tsx"),
      "utf8",
    );
    // Every CollapsePanel in these SettingsContentCard consumers should opt into nested.
    const generalPanels = collapsePanelOpenTags(generalSrc);
    const mcpPanels = collapsePanelOpenTags(mcpDocsSrc);
    const advancedPanels = collapsePanelOpenTags(advancedSrc);
    const themePanels = collapsePanelOpenTags(themeSrc);
    expect(generalPanels.length).toBeGreaterThan(0);
    expect(mcpPanels.length).toBeGreaterThan(0);
    expect(advancedPanels.length).toBeGreaterThan(0);
    expect(themePanels.length).toBeGreaterThan(0);
    for (const tag of [...generalPanels, ...mcpPanels, ...advancedPanels, ...themePanels]) {
      expect(tag).toMatch(/\bnested\b/);
    }
  });

  it("Timeline / sticky-chrome editors keep page fills free of overflow-hidden", () => {
    const timelineSrc = readFileSync(
      resolve(here, "../pages/timeline/TimelinePage.tsx"),
      "utf8",
    );
    const chatEditorSrc = readFileSync(
      resolve(here, "../pages/tasks/chat-editor/ChatEditorPage.tsx"),
      "utf8",
    );
    const recurringSrc = readFileSync(
      resolve(here, "../pages/schedule/RecurringSeriesEditor.tsx"),
      "utf8",
    );
    expect(timelineSrc).toMatch(/timeline-page-fill[^"\n]*/);
    expect(timelineSrc).not.toMatch(/timeline-page-fill[^"\n]*overflow-hidden/);
    expect(chatEditorSrc).toContain("stickyChromePageFillClass");
    expect(chatEditorSrc).not.toMatch(/im-page-shell[^"\n]*overflow-hidden/);
    expect(recurringSrc).toContain("stickyChromePageFillClass");
    expect(recurringSrc).not.toMatch(/im-page-shell[^"\n]*overflow-hidden/);
  });

  it("does not pair frosted menu surfaces with opaque bg-surface-card", () => {
    expect(menuSelectSrc).toContain("im-menu-surface");
    expect(menuSelectSrc).not.toMatch(/im-menu-surface[^"\n]*bg-surface-card/);
    expect(linkedCalSrc).toContain("im-menu-surface");
    expect(linkedCalSrc).not.toMatch(/im-menu-surface[^"\n]*bg-surface-card/);
  });

  it("sets early data-theme-bg from localStorage keys matching themeData", () => {
    expect(indexHtml).toContain("im:theme");
    expect(indexHtml).toContain("im:theme-bg-mode:");
    expect(indexHtml).toContain("im:theme-bg:");
    expect(indexHtml).toContain('setAttribute("data-theme-bg"');
    expect(indexHtml).toMatch(/localStorage\.getItem\("im:theme"\)/);
  });

  it("does not put Tailwind bg-surface-base on im-app-shell (utilities beat photo transparent)", () => {
    const appSrc = readFileSync(resolve(here, "../App.tsx"), "utf8");
    expect(appSrc).toMatch(/im-app-shell[^"\n]*/);
    const shellClass = appSrc.match(/className="(im-app-shell[^"]*)"/)?.[1] ?? "";
    expect(shellClass).toContain("im-app-shell");
    expect(shellClass).not.toContain("bg-surface-base");
  });

  it("keeps Sources cards free of overflow-hidden that kills backdrop-filter", () => {
    const sourceCardSrc = readFileSync(
      resolve(here, "../pages/sources/board/SourceCard.tsx"),
      "utf8",
    );
    expect(sourceCardSrc).toMatch(/sources-card[^"\n]*/);
    expect(sourceCardSrc).not.toMatch(/sources-card[^"\n]*overflow-hidden/);
  });

  it("Sources list nests PanelSection without a second frosted panel shell", () => {
    expect(panelSectionSrc).toContain('surface?: "panel" | "none"');
    expect(sourceListSectionSrc).toContain('surface="none"');
    expect(sourceListSectionSrc).not.toMatch(/bg-transparent/);
    expect(sourceBoardFormClass).toContain("bg-transparent");
    expect(sourceBoardListClass).toContain("bg-transparent");
  });

  it("FeedCard / Schedule / StatsStrip / timeline cards use panel material not opaque card fill", () => {
    expect(feedCardSrc).toContain("im-material-panel");
    expect(feedCardSrc).not.toMatch(/bg-surface-card/);
    expect(feedCardSrc).not.toMatch(/im-feed-tile[^"\n]*overflow-hidden/);
    expect(scheduleEventCardSrc).toContain("FeedCard");
    expect(statsStripSrc).toContain("im-surface-panel");
    expect(statsStripSrc).not.toMatch(/bg-surface-card/);
    expect(timelineEventCardSrc).toContain("im-surface-panel");
    expect(timelineEventCardSrc).not.toMatch(/bg-surface-card/);
    expect(calendarCellSrc).toContain("im-material-panel");
    expect(calendarCellSrc).toContain("im-surface-inset");
    expect(calendarCellSrc).not.toMatch(/bg-surface-card/);
  });

  it("readable glass consumers: sidebar frost, timeline detail, calendar, map, emoji", () => {
    const timelineSidebarSrc = readFileSync(
      resolve(here, "../pages/timeline/components/TimelineSidebar.tsx"),
      "utf8",
    );
    const taskDetailSrc = readFileSync(
      resolve(here, "../pages/timeline/components/TaskDetailPanel.tsx"),
      "utf8",
    );
    const monthCalSrc = readFileSync(
      resolve(here, "../pages/timeline/calendar/timelineCalendarClasses.ts"),
      "utf8",
    );
    const mapCss = readFileSync(resolve(here, "../css/intelligence-map.css"), "utf8");
    const mapClassesSrc = readFileSync(
      resolve(here, "../pages/intelligence/map/mapViewClasses.ts"),
      "utf8",
    );
    const emojiPanelSrc = readFileSync(
      resolve(here, "../components/items/emoji/EmojiPickerPanel.tsx"),
      "utf8",
    );
    const ganttSrc = readFileSync(
      resolve(here, "../pages/timeline/gantt/timelineGanttClasses.ts"),
      "utf8",
    );

    expect(timelineSidebarSrc).toContain("im-surface-panel");
    expect(taskDetailSrc).toContain("im-surface-panel");
    expect(taskDetailSrc).not.toContain("timelinePanelClass");
    expect(monthCalSrc).not.toMatch(/surface-panel\)_32%/);
    expect(monthCalSrc).toContain("im-surface-inset");
    expect(mapCss).toMatch(
      /\.im-map-overlay-panel\s*\{[^}]*background:\s*var\(--surface-panel\)/s,
    );
    expect(mapCss).toMatch(
      /\.im-map-danmaku-panel\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-panel\)\)/s,
    );
    expect(mapClassesSrc).toContain("im-surface-panel");
    expect(mapClassesSrc).not.toMatch(/rgba\(30,30,46/);
    expect(emojiPanelSrc).toContain("im-menu-surface");
    expect(emojiPanelSrc).not.toMatch(/bg-\[color-mix\(in_srgb,var\(--surface-card\)/);
    expect(ganttSrc).toContain("im-surface-chrome");
    expect(ganttSrc).toContain("im-surface-panel");
    expect(texturesCss).toContain("--theme-bg-wash-pct: 62%");
  });

  it("special-family glass-bg hover does not override photo-BG panel SoT", () => {
    expect(themeGeneratedCss).toContain(
      '[data-theme-family="special"]:not([data-theme-bg="custom"]):not([data-theme-bg="focal"]) :is(.im-card-hover)',
    );
    expect(themeGeneratedCss).not.toMatch(
      /\[data-theme-family="special"\] :is\(\.im-card-hover\)/,
    );
  });
});
