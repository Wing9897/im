/** Presets for published workset auto-sync. Floor comes from GET/PATCH ``autoSyncIntervalFloorSeconds``. */

export const AUTO_SYNC_INTERVAL_FLOOR_SECONDS = 60;

export type AutoSyncPresetValue = "off" | 60 | 300 | 900 | 3600;

export const AUTO_SYNC_PRESET_SECONDS: readonly AutoSyncPresetValue[] = [
  "off",
  60,
  300,
  900,
  3600,
] as const;

export function autoSyncPresetFromRow(
  autoSync: boolean,
  intervalSeconds: number,
  floorSeconds: number = AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
): AutoSyncPresetValue {
  if (!autoSync) return "off";
  const match = AUTO_SYNC_PRESET_SECONDS.find(
    (value): value is Exclude<AutoSyncPresetValue, "off"> =>
      typeof value === "number" && value === intervalSeconds,
  );
  if (match) return match;
  return floorSeconds === 60 || floorSeconds === 300 || floorSeconds === 900 || floorSeconds === 3600
    ? floorSeconds
    : 60;
}

export function autoSyncPatchFromPreset(preset: AutoSyncPresetValue): {
  autoSync: boolean;
  autoSyncIntervalSeconds?: number;
} {
  if (preset === "off") return { autoSync: false };
  return { autoSync: true, autoSyncIntervalSeconds: preset };
}
