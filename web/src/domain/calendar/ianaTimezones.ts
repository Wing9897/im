import type { MenuSelectOption } from "../../components/ui";

/** Common household IANA cities. The live OS zone is prepended at render time. */
export const COMMON_IANA_TIMEZONES = [
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Shanghai",
  "Asia/Macau",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Bangkok",
  "Asia/Kuala_Lumpur",
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

export function systemIanaTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function calendarTimezoneOptions(preferred: string, selected = ""): MenuSelectOption[] {
  const first = preferred.trim() || systemIanaTimezone();
  const seen = new Set<string>();
  const options: MenuSelectOption[] = [];
  const push = (value: string) => {
    const id = value.trim();
    if (!id || seen.has(id)) return;
    seen.add(id);
    options.push({ value: id, label: id.replaceAll("_", " ") });
  };
  push(first);
  push(selected);
  push(systemIanaTimezone());
  for (const id of COMMON_IANA_TIMEZONES) push(id);
  return options;
}
