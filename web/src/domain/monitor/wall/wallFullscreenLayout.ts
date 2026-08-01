/** Fullscreen wall grid: prefer landscape cells so ~8 cards fit one viewport. */

export function wallFullscreenGrid(count: number): { cols: number; rows: number } {
  const n = Math.max(0, Math.floor(count));
  if (n <= 1) return { cols: 1, rows: Math.max(n, 1) };
  if (n === 2) return { cols: 2, rows: 1 };
  if (n === 3) return { cols: 3, rows: 1 };
  if (n === 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 3, rows: 2 };
  if (n <= 8) return { cols: 4, rows: 2 };
  if (n <= 9) return { cols: 3, rows: 3 };
  if (n <= 12) return { cols: 4, rows: 3 };
  const cols = Math.ceil(Math.sqrt(n));
  return { cols, rows: Math.ceil(n / cols) };
}
