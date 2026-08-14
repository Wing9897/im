/**
 * Surface layer tokens — photo BG (custom / focal) glass system.
 * Token + key class-string contracts only (no whole-page source scans).
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

describe("surface layer tokens", () => {
  it("defines chrome / panel / inset defaults on html", () => {
    expect(themeCss).toContain("--surface-chrome:");
    expect(themeCss).toContain("--surface-panel:");
    expect(themeCss).toContain("--surface-inset:");
    expect(themeCss).toContain("--surface-blur-chrome:");
    expect(themeCss).toContain("--surface-blur-panel:");
  });

  it("softens layers under photo BG modes without forcing glass on none", () => {
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
    expect(surfaceCss).toMatch(
      /\.im-material-elevated\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-panel\)\)/s,
    );
    expect(surfaceCss).not.toMatch(
      /\.im-material-elevated\s*\{[^}]*overflow:\s*hidden/s,
    );
    expect(surfaceCss).not.toMatch(
      /\.im-material-elevated\s*\{[^}/]*isolation:\s*isolate/s,
    );
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
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-shell-sidebar,\s*html\[data-theme-bg="focal"\] \.im-shell-sidebar\s*\{[^}]*var\(--surface-chrome\)/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-shell-sidebar,\s*html\[data-theme-bg="focal"\] \.im-shell-sidebar\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-chrome\)\)/s,
    );
    expect(surfaceCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-surface-inset,\s*html\[data-theme-bg="focal"\] \.im-surface-inset\s*\{[^}]*backdrop-filter:\s*blur\(var\(--surface-blur-panel\)\)/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\] \.im-app-shell,\s*html\[data-theme-bg="focal"\] \.im-app-shell\s*\{[^}]*background-color:\s*transparent/s,
    );
    expect(texturesCss).toMatch(
      /html\[data-theme-bg="custom"\],\s*html\[data-theme-bg="focal"\]\s*\{[^}]*--texture-opacity:\s*0/s,
    );
    expect(texturesCss).toContain(".im-fs-atmosphere:fullscreen");
    expect(texturesCss).toContain("--theme-bg-wash-pct: 62%");
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
    expect(layoutCss).toMatch(
      /html\[data-theme-bg="custom"\] \.app-main-content > \*,\s*html\[data-theme-bg="focal"\] \.app-main-content > \*\s*\{\s*animation:\s*none;/s,
    );
  });

  it("wires shell / settings / sources / Items class strings to layer tokens", () => {
    expect(pageChromeOuterClass).toContain("im-surface-chrome");
    expect(pageChromeOuterClass).toContain("rounded-xl");
    expect(pageChromeOuterClass).toContain("mx-page-x");
    expect(pageChromeOuterClass).toContain("mt-md");
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
    expect(itemsPageFillClass).not.toContain("surface-page");
    expect(itemFormPageFillClass).not.toContain("surface-page");
    expect(itemsPageFillClass).not.toContain("overflow-hidden");
    expect(itemFormPageFillClass).not.toContain("overflow-hidden");
    expect(stickyChromePageFillClass).not.toContain("overflow-hidden");
    expect(surfaceCss).not.toMatch(
      /\.im-control-bar\s*\{[^}]*overflow:\s*hidden/s,
    );
  });

  it("keeps dialog / detail frost free of overflow-hidden and opaque card fill", () => {
    expect(dialogShellClass).toContain("im-material-panel");
    expect(compactSourceDialogShellClass).toContain(dialogShellClass);
    expect(compactSourceDialogShellClass).not.toMatch(/bg-surface-card/);
    expect(detailDialogModalShellClass).toContain("im-material-panel");
    expect(detailDialogModalShellClass).not.toContain("overflow-hidden");
    expect(detailDialogDrawerShellClass).not.toContain("overflow-hidden");
    expect(detailDialogScrollBodyClass).toMatch(/overflow-y-auto/);
  });

  it("sets early data-theme-bg from localStorage keys matching themeData", () => {
    expect(indexHtml).toContain("im:theme");
    expect(indexHtml).toContain("im:theme-bg-mode:");
    expect(indexHtml).toContain("im:theme-bg:");
    expect(indexHtml).toContain('setAttribute("data-theme-bg"');
    expect(indexHtml).toMatch(/localStorage\.getItem\("im:theme"\)/);
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
