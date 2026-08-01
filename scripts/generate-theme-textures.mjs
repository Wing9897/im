/**
 * Emit web/src/css/theme-textures.css with thematic motif SVGs.
 * Run: node scripts/generate-theme-textures.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "web", "src", "css", "theme-textures.css");

function url(svg) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, " ").trim())}")`;
}

const motifs = {
  grain: {
    size: "160px 160px",
    opacity: "0.07",
    blend: "soft-light",
    pageBlend: "soft-light",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)" opacity="0.55"/></svg>`,
  },
  washi: {
    size: "200px 200px",
    opacity: "0.08",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.45 0 0 0 0 0.4 0 0 0 0 0.32 0 0 0 0.45 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`,
  },
  moss: {
    size: "160px 160px",
    opacity: "0.1",
    blend: "soft-light",
    pageBlend: "soft-light",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g fill="#4a7048" fill-opacity="0.22"><ellipse cx="30" cy="40" rx="14" ry="9" transform="rotate(-20 30 40)"/><ellipse cx="78" cy="28" rx="11" ry="7" transform="rotate(15 78 28)"/><ellipse cx="120" cy="52" rx="13" ry="8" transform="rotate(-8 120 52)"/><ellipse cx="48" cy="90" rx="12" ry="8" transform="rotate(25 48 90)"/><ellipse cx="100" cy="110" rx="15" ry="9" transform="rotate(-18 100 110)"/><ellipse cx="140" cy="130" rx="10" ry="6"/></g><g fill="none" stroke="#3d5a32" stroke-width="1" stroke-opacity="0.3"><path d="M22 120c6-12 16-12 20 0-8 12-16 12-20 0z"/><path d="M110 78c5-10 14-10 18 0-7 10-14 10-18 0z"/></g></svg>`,
  },
  leaf: {
    size: "140px 140px",
    opacity: "0.12",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140"><g fill="none" stroke="#3a5a32" stroke-width="1.15" stroke-opacity="0.3"><path d="M28 52c10-22 28-22 36 0-12 22-28 22-36 0z"/><path d="M46 52c-2 8-8 14-14 18"/><path d="M96 34c8-16 22-14 28 2-10 16-22 14-28-2z"/><path d="M110 35c-1 6-6 12-12 15"/><path d="M58 108c12-18 30-14 34 4-14 16-30 12-34-4z"/><path d="M75 109c0 7-5 13-11 16"/><path d="M18 98c6-10 16-8 18 2-8 9-16 6-18-2z"/></g></svg>`,
  },
  wood: {
    size: "200px 120px",
    opacity: "0.11",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><g fill="none" stroke="#a07848" stroke-width="1.1" stroke-opacity="0.34"><path d="M0 14c48 10 96-12 200 6"/><path d="M0 30c56-8 110 14 200-4"/><path d="M0 46c42 12 108-10 200 8"/><path d="M0 62c60-10 100 12 200-2"/><path d="M0 78c44 10 112-8 200 6"/><path d="M0 94c52-8 104 10 200-4"/><path d="M0 110c40 8 116-6 200 4"/></g></svg>`,
  },
  wave: {
    size: "160px 80px",
    opacity: "0.11",
    blend: "soft-light",
    pageBlend: "soft-light",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80" viewBox="0 0 160 80"><g fill="none" stroke="#90c4d0" stroke-width="1.25" stroke-opacity="0.34"><path d="M0 20c20-14 40-14 60 0s40 14 60 0 40-14 60 0"/><path d="M0 40c20-14 40-14 60 0s40 14 60 0 40-14 60 0"/><path d="M0 60c20-14 40-14 60 0s40 14 60 0 40-14 60 0"/></g></svg>`,
  },
  frost: {
    size: "96px 96px",
    opacity: "0.1",
    blend: "soft-light",
    pageBlend: "soft-light",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g fill="none" stroke="#b8d0e8" stroke-width="1" stroke-opacity="0.3" stroke-linecap="round"><path d="M48 12v72M12 48h72"/><path d="M24 24l48 48M72 24L24 72"/><path d="M48 20l8 14M48 20l-8 14M48 76l8-14M48 76l-8-14"/><path d="M20 48l14 8M20 48l14-8M76 48l-14 8M76 48l-14-8"/></g></svg>`,
  },
  ember: {
    size: "120px 120px",
    opacity: "0.12",
    blend: "screen",
    pageBlend: "screen",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><g fill="#e09050"><circle cx="18" cy="22" r="1.4" opacity="0.4"/><circle cx="52" cy="16" r="1" opacity="0.32"/><circle cx="88" cy="28" r="1.6" opacity="0.38"/><circle cx="34" cy="58" r="1.2" opacity="0.34"/><circle cx="70" cy="48" r="0.9" opacity="0.28"/><circle cx="102" cy="62" r="1.3" opacity="0.36"/><circle cx="24" cy="92" r="1.1" opacity="0.3"/><circle cx="58" cy="84" r="1.5" opacity="0.38"/><circle cx="96" cy="98" r="1" opacity="0.28"/><circle cx="44" cy="36" r="0.8" opacity="0.24"/></g><g stroke="#d07040" stroke-width="1" stroke-opacity="0.28" stroke-linecap="round"><path d="M30 40l4-10M76 70l-3-9M50 100l2-8"/></g></svg>`,
  },
  petal: {
    size: "130px 130px",
    opacity: "0.12",
    blend: "soft-light",
    pageBlend: "soft-light",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" viewBox="0 0 130 130"><g fill="#f0a0b8" fill-opacity="0.26"><ellipse cx="28" cy="36" rx="7" ry="11" transform="rotate(-28 28 36)"/><ellipse cx="78" cy="24" rx="6" ry="10" transform="rotate(18 78 24)"/><ellipse cx="104" cy="70" rx="7" ry="11" transform="rotate(-12 104 70)"/><ellipse cx="46" cy="88" rx="6" ry="10" transform="rotate(32 46 88)"/><ellipse cx="90" cy="104" rx="5" ry="9" transform="rotate(-20 90 104)"/><ellipse cx="20" cy="100" rx="5" ry="8" transform="rotate(10 20 100)"/></g></svg>`,
  },
  mist: {
    size: "200px 120px",
    opacity: "0.14",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><g fill="none" stroke="#607080" stroke-width="6" stroke-opacity="0.12" stroke-linecap="round"><path d="M-10 24c40 12 70-10 110 4s70-8 110 6"/><path d="M-10 52c36-10 80 12 120 0s70 10 100-4"/><path d="M-10 80c44 10 76-12 118 2s72-6 102 8"/><path d="M-10 104c38-8 84 8 122-2s68 8 98 2"/></g></svg>`,
  },
  linen: {
    size: "48px 48px",
    opacity: "0.09",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g stroke="#888880" stroke-width="0.8" stroke-opacity="0.24"><path d="M0 12h48M0 24h48M0 36h48"/><path d="M12 0v48M24 0v48M36 0v48"/></g></svg>`,
  },
  grid: {
    size: "48px 48px",
    opacity: "0.08",
    blend: "overlay",
    pageBlend: "overlay",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M48 0H0v48" fill="none" stroke="#ffffff" stroke-opacity="0.16" stroke-width="1"/></svg>`,
  },
  dune: {
    size: "200px 100px",
    opacity: "0.11",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100"><g fill="none" stroke="#c49a6c" stroke-width="1.4" stroke-opacity="0.32"><path d="M0 18c30 14 60-14 100 0s70-12 100 4"/><path d="M0 38c34-12 66 14 100 2s68 12 100-4"/><path d="M0 58c28 12 70-10 100 2s66-14 100 4"/><path d="M0 78c36-10 64 12 100 0s70 10 100-2"/></g></svg>`,
  },
  ink: {
    size: "200px 200px",
    opacity: "0.1",
    blend: "multiply",
    pageBlend: "multiply",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><g fill="#1a1512" fill-opacity="0.2"><ellipse cx="40" cy="50" rx="28" ry="10" transform="rotate(-35 40 50)"/><ellipse cx="130" cy="40" rx="34" ry="8" transform="rotate(20 130 40)"/><ellipse cx="80" cy="120" rx="40" ry="9" transform="rotate(-12 80 120)"/><ellipse cx="160" cy="150" rx="26" ry="7" transform="rotate(28 160 150)"/><circle cx="60" cy="170" r="4" opacity="0.7"/><circle cx="150" cy="90" r="3" opacity="0.6"/></g></svg>`,
  },
};

const comments = {
  grain: "Fine film grain (desk / neutral)",
  washi: "Paper fiber (和紙)",
  moss: "Moss patches + tiny leaves",
  leaf: "Scattered leaf outlines (orchard / nature)",
  wood: "Wood grain lines",
  wave: "Harbor water ripples",
  frost: "Nordic frost crystals",
  ember: "Ash sparks / embers",
  petal: "Sakura petal silhouettes",
  mist: "Soft fog bands",
  linen: "Woven linen crosshatch",
  grid: "Technical grid",
  dune: "Sand dune ridges",
  ink: "Sumi brush strokes",
};

const blocks = Object.entries(motifs)
  .map(([id, m]) => {
    return [
      `/* ${comments[id] ?? id} */`,
      `[data-theme-texture="${id}"] {`,
      `  --texture-opacity: ${m.opacity};`,
      `  --texture-blend: ${m.blend};`,
      `  --page-texture-blend: ${m.pageBlend};`,
      `  --texture-size: ${m.size};`,
      `  --texture-image: ${url(m.svg)};`,
      `}`,
    ].join("\n");
  })
  .join("\n\n");

const css = `/* AUTO hint: regenerate with \`node scripts/generate-theme-textures.mjs\` when editing motifs.
   Selective textures — elevated cards, control bars, secondary buttons,
   AND page/sidebar atmosphere when no custom photo background is set.
   Driven by html[data-theme-texture] + html[data-theme-bg]. */

:root {
  --texture-opacity: 0;
  --texture-image: none;
  --texture-blend: soft-light;
  --texture-size: 140px 140px;
  --page-texture-blend: soft-light;
}

${blocks}

[data-theme-texture="none"] {
  --texture-opacity: 0;
  --texture-image: none;
}

/* Light themes: soft-light motifs need multiply to read on paper */
html[data-theme-mode="light"][data-theme-texture="grain"],
html[data-theme-mode="light"][data-theme-texture="moss"],
html[data-theme-mode="light"][data-theme-texture="frost"],
html[data-theme-mode="light"][data-theme-texture="wave"],
html[data-theme-mode="light"][data-theme-texture="petal"],
html[data-theme-mode="light"][data-theme-texture="ember"] {
  --page-texture-blend: multiply;
  --texture-blend: multiply;
}

html[data-theme-mode="light"][data-theme-texture="grid"] {
  --page-texture-blend: multiply;
  --texture-blend: multiply;
  --texture-image: ${url(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><path d="M48 0H0v48" fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="1"/></svg>`)};
}

/*
 * Page/sidebar atmosphere painted INTO the surface background.
 * body::after sat under opaque .im-page-canvas fills and was invisible.
 */
html:not([data-theme-bg="custom"]):not([data-theme-texture="none"]) .im-page-canvas {
  background-image:
    var(--texture-image),
    radial-gradient(ellipse 90% 55% at 50% -18%, var(--im-page-glow), transparent 62%),
    linear-gradient(
      var(--surface-page, var(--surface-base)),
      var(--surface-page, var(--surface-base))
    );
  background-size: var(--texture-size, 140px 140px), auto, auto;
  background-repeat: repeat, no-repeat, no-repeat;
  background-blend-mode: var(--page-texture-blend, soft-light), normal, normal;
}

html:not([data-theme-bg="custom"]):not([data-theme-texture="none"]) .im-shell-sidebar {
  background-image:
    var(--texture-image),
    linear-gradient(
      var(--surface-sidebar, var(--surface-base)),
      var(--surface-sidebar, var(--surface-base))
    );
  background-size: var(--texture-size, 140px 140px), auto;
  background-repeat: repeat, no-repeat;
  background-blend-mode: var(--page-texture-blend, soft-light), normal;
}

.im-texture-target {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}

.im-texture-target::after {
  content: "";
  pointer-events: none;
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: var(--texture-opacity, 0);
  background-image: var(--texture-image, none);
  background-size: var(--texture-size, 140px 140px);
  background-repeat: repeat;
  mix-blend-mode: var(--texture-blend, soft-light);
  z-index: 1;
}

.im-texture-target > * {
  position: relative;
  z-index: 2;
}
`;

writeFileSync(outPath, css, "utf8");
console.log(`[gen:textures] Wrote ${path.relative(path.join(__dirname, ".."), outPath)} (${Object.keys(motifs).length} motifs)`);
