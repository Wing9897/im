import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  monthEventDotClass,
  monthSpanEndingIconClass,
  monthSpanOngoingIconClass,
} from "../pages/timeline/calendar/timelineCalendarClasses";

const themeCss = [
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../theme.css"), "utf8"),
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../theme.generated.css"),
    "utf8",
  ),
].join("\n");

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function dist(a: string, b: string): number {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

function parseThemeBlocks(css: string): Array<{ id: string; body: string }> {
  const byId = new Map<string, string>();
  const re = /\[data-theme="([^"]+)"\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    const id = match[1];
    const start = css.indexOf("{", match.index);
    if (start < 0) continue;
    let depth = 0;
    let end = -1;
    for (let j = start; j < css.length; j++) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") {
        depth--;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }
    if (end < 0) continue;
    // Later blocks (collision overrides) must win — append so tokenHex finds them first via last match.
    const chunk = css.slice(start + 1, end);
    byId.set(id, `${byId.get(id) ?? ""}\n${chunk}`);
  }
  return [...byId.entries()].map(([id, body]) => ({ id, body }));
}

/** Prefer the last declaration of a token (theme overrides append after base). */
function tokenHex(body: string, name: string): string | null {
  const hexMatches = [
    ...body.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]+)`, "g")),
  ];
  if (hexMatches.length > 0) {
    return hexMatches[hexMatches.length - 1]![1] ?? null;
  }
  const refMatches = [
    ...body.matchAll(new RegExp(`--${name}:\\s*var\\(--([a-z0-9-]+)\\)`, "g")),
  ];
  if (refMatches.length > 0) {
    const ref = refMatches[refMatches.length - 1]![1];
    return ref ? tokenHex(body, ref) : null;
  }
  return null;
}

describe("month calendar status dots", () => {
  it("bind to dedicated calendar-dot tokens (not raw accent/success)", () => {
    expect(monthEventDotClass).toContain("var(--calendar-dot-event)");
    expect(monthSpanOngoingIconClass).toContain("var(--calendar-dot-ongoing)");
    expect(monthSpanEndingIconClass).toContain("var(--calendar-dot-ending)");
    expect(monthSpanEndingIconClass).not.toContain("text-success");
  });

  it("keeps 一般 / 進行中 / 完結 dots distinguishable across themes", () => {
    expect(themeCss).toContain("--calendar-dot-event:");
    expect(themeCss).toContain("--calendar-dot-ongoing:");
    expect(themeCss).toContain("--calendar-dot-ending:");

    const shared = themeCss.match(/\[data-theme\]\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(shared).toMatch(/--calendar-dot-event:\s*var\(--accent\)/);
    expect(shared).toMatch(/--calendar-dot-ongoing:\s*var\(--info\)/);
    expect(shared).toMatch(/--calendar-dot-ending:\s*var\(--warning\)/);

    const MIN_DIST = 70;
    const collisions: string[] = [];

    for (const { id, body } of parseThemeBlocks(themeCss)) {
      if (!body.includes("--accent:")) continue;

      const event =
        tokenHex(body, "calendar-dot-event") ?? tokenHex(body, "accent");
      const ongoing =
        tokenHex(body, "calendar-dot-ongoing") ?? tokenHex(body, "info");
      const ending =
        tokenHex(body, "calendar-dot-ending") ?? tokenHex(body, "warning");
      if (!event || !ongoing || !ending) continue;

      const pairs: Array<[string, string, string]> = [
        ["event-ongoing", event, ongoing],
        ["event-ending", event, ending],
        ["ongoing-ending", ongoing, ending],
      ];
      for (const [pair, a, b] of pairs) {
        const d = dist(a, b);
        if (d < MIN_DIST) {
          collisions.push(`${id} ${pair} d=${Math.round(d)} ${a}/${b}`);
        }
      }
    }

    expect(collisions).toEqual([]);
  });
});
