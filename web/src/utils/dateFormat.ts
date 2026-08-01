/** Format timestamp as "YYYY-MM-DD HH:MM" in local time */
export function formatDateTime(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format timestamp as "YYYY-MM-DD" in local time */
export function formatDateOnly(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return dateKey(d);
}

/** Local calendar date key `YYYY-MM-DD` from a `Date` (ignores time-of-day). */
export function dateKey(day: Date): string {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

/** Format timestamp as tick label with date + time */
export function formatTickLabel(ts: number | null | undefined): string {
  if (ts == null || !Number.isFinite(ts)) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours();
  const m = d.getMinutes();
  const s = d.getSeconds();
  const datePart = `${mo}/${day}`;
  if (h === 0 && m === 0 && s === 0) return datePart;
  const timePart = s !== 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${datePart} ${timePart}`;
}
