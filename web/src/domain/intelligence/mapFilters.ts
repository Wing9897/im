import type { AnalysisEvent, TimeWindow } from "../../types";

/** 座標分區結果 */
interface CoordinatePartition {
  withCoords: AnalysisEvent[];
  withoutCoords: AnalysisEvent[];
}

type TimestampSource = AnalysisEvent & {
  startTime?: string | null;
};

/**
 * 取得事件時間戳：startTime → sourceMessageTime → createdAt。
 */
export function getEventTimestamp(item: TimestampSource): string {
  if (item.startTime) return item.startTime;
  if (item.sourceMessageTime) return item.sourceMessageTime;
  return item.createdAt;
}

/**
 * 判斷座標是否可上地圖：lat/lng 皆有值、在合法範圍內，且不是 0,0 哨兵
 * （線上／不明地點的 Null Island）。
 */
export function isMappableCoordinate(
  lat: number | null | undefined,
  lng: number | null | undefined,
): lat is number {
  return (
    lat != null &&
    lng != null &&
    !(lat === 0 && lng === 0) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * 將項目分為有效座標與無效/缺失座標兩組。
 *
 * 有效座標條件：非 null、非 0,0 哨兵、lat ∈ [-90,90]、lng ∈ [-180,180]。
 */
export function partitionByCoordinates(
  items: AnalysisEvent[],
): CoordinatePartition {
  const withCoords: AnalysisEvent[] = [];
  const withoutCoords: AnalysisEvent[] = [];

  for (const item of items) {
    if (isMappableCoordinate(item.latitude, item.longitude)) {
      withCoords.push(item);
    } else {
      withoutCoords.push(item);
    }
  }

  return { withCoords, withoutCoords };
}

/**
 * 計算項目集合的時間範圍（最早與最晚時間戳）。
 *
 * 若項目列表為空，回傳當前時間作為 start 和 end。
 */
export function computeDataRange(items: AnalysisEvent[]): TimeWindow {
  if (items.length === 0) {
    const now = new Date();
    return { start: now, end: now };
  }

  let earliest = Infinity;
  let latest = -Infinity;

  for (const item of items) {
    const ts = new Date(getEventTimestamp(item)).getTime();
    if (ts < earliest) earliest = ts;
    if (ts > latest) latest = ts;
  }

  return { start: new Date(earliest), end: new Date(latest) };
}
