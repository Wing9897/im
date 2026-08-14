const SYSTEM_TIMEZONE_LOCATIONS: Record<string, string> = {
  "Asia/Taipei": "臺北",
  "Asia/Hong_Kong": "香港",
  "Asia/Tokyo": "東京",
  "Asia/Shanghai": "上海",
  "Asia/Singapore": "新加坡",
  "Asia/Seoul": "首爾",
  "America/New_York": "New York",
  "America/Los_Angeles": "Los Angeles",
  "Europe/London": "London",
  "Europe/Paris": "Paris",
};

export function systemLocationFromTimezone(timezone: string): string {
  const knownLocation = SYSTEM_TIMEZONE_LOCATIONS[timezone];
  if (knownLocation) return knownLocation;
  const segments = timezone.split("/");
  const inferredCity = segments.at(-1)?.replaceAll("_", " ");
  // UTC and other non-geographic zones do not identify a city. A predictable
  // fallback keeps the default setting useful until a custom city is chosen.
  return inferredCity && inferredCity !== "UTC" ? inferredCity : "臺北";
}

export function systemLocation(): string {
  return systemLocationFromTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}
