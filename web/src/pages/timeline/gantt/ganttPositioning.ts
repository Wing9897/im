/**
 * 截斷任務名稱，超過 maxLength 字元時加上省略號。
 */
export function truncateLabel(name: string, maxLength: number): string {
  if (name.length <= maxLength) {
    return name;
  }
  return `${name.slice(0, maxLength)}…`;
}
