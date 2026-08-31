/** Shared canvas timebar geometry — map slider and gantt 全局/Overview footer. */

export const ONE_HOUR = 3600_000;
const ONE_DAY = 24 * ONE_HOUR;

export const CANVAS_H = 44;
const TRACK_H = 14;
const TRACK_Y = (CANVAS_H - TRACK_H) / 2;
const HANDLE_W = 12;
const HANDLE_H = 30;
const HANDLE_Y = (CANVAS_H - HANDLE_H) / 2;

export type HitZone = "left" | "right" | "range" | "bg";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function genTicks(lo: number, hi: number, maxTicks: number): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];

  const steps = [
    1000, 10_000, 30_000, 60_000,
    5 * 60_000, 15 * 60_000, 30 * 60_000,
    ONE_HOUR, 3 * ONE_HOUR, 6 * ONE_HOUR, 12 * ONE_HOUR,
    ONE_DAY, 7 * ONE_DAY, 30 * ONE_DAY,
  ];

  let step = steps[steps.length - 1];
  for (const s of steps) {
    if (span / s <= maxTicks) {
      step = s;
      break;
    }
  }

  const first = Math.ceil(lo / step) * step;
  const t: number[] = [];
  for (let ts = first; ts <= hi; ts += step) t.push(ts);
  return t;
}

export function hitTest(x: number, lx: number, rx: number): HitZone {
  const pad = 14;
  if (Math.abs(x - lx) <= HANDLE_W / 2 + pad) return "left";
  if (Math.abs(x - rx) <= HANDLE_W / 2 + pad) return "right";
  if (x > lx + HANDLE_W / 2 && x < rx - HANDLE_W / 2) return "range";
  return "bg";
}

export function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  lx: number,
  rx: number,
  drag: HitZone | null,
  ticks: number[],
  viewStart: number,
  viewSpan: number,
  dataMinX: number,
  dataMaxX: number,
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, w * dpr, CANVAS_H * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = cssVar("--surface-border", "#585b70");
  ctx.beginPath();
  ctx.roundRect(0, TRACK_Y, w, TRACK_H, 7);
  ctx.fill();

  if (dataMaxX > dataMinX) {
    const dLx = clamp(dataMinX, 0, w);
    const dRx = clamp(dataMaxX, 0, w);
    if (dRx > dLx) {
      ctx.fillStyle = cssVar("--surface-border-alpha", "rgba(88,91,112,0.4)");
      ctx.beginPath();
      ctx.roundRect(dLx, TRACK_Y, dRx - dLx, TRACK_H, 4);
      ctx.fill();
    }
  }

  for (const ts of ticks) {
    const tx = ((ts - viewStart) / viewSpan) * w;
    if (tx < -1 || tx > w + 1) continue;
    ctx.strokeStyle = cssVar("--surface-border-alpha", "rgba(88,91,112,0.5)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, TRACK_Y);
    ctx.lineTo(tx, TRACK_Y + TRACK_H);
    ctx.stroke();
  }

  const selL = clamp(lx, 0, w);
  const selR = clamp(rx, 0, w);
  if (selR > selL) {
    const info = cssVar("--info", "#89b4fa");
    ctx.fillStyle = drag === "range"
      ? `color-mix(in srgb, ${info} 55%, transparent)`
      : `color-mix(in srgb, ${info} 40%, transparent)`;
    ctx.beginPath();
    ctx.roundRect(selL, TRACK_Y, selR - selL, TRACK_H, 4);
    ctx.fill();
  }

  const drawH = (cx: number, active: boolean) => {
    if (cx < -HANDLE_W || cx > w + HANDLE_W) return;
    ctx.fillStyle = active ? cssVar("--peach", "#f5e0dc") : cssVar("--text-primary", "#cdd6f4");
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.beginPath();
    ctx.roundRect(cx - HANDLE_W / 2, HANDLE_Y, HANDLE_W, HANDLE_H, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = cssVar("--surface-base", "#1e1e2e");
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 2, HANDLE_Y + 10);
    ctx.lineTo(cx - 2, HANDLE_Y + 20);
    ctx.moveTo(cx + 2, HANDLE_Y + 10);
    ctx.lineTo(cx + 2, HANDLE_Y + 20);
    ctx.stroke();
  };
  drawH(lx, drag === "left");
  drawH(rx, drag === "right");

  ctx.restore();
}
