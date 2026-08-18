import type { DueReminder } from "./scanner";
import { claimFiredKeys, loadFiredKeys, saveFiredKeys } from "./scanner";

export async function persistFiredKeys(
  firedKeys: ReadonlySet<string>,
  onFailure: (message: string) => void,
): Promise<void> {
  const ok = await saveFiredKeys(firedKeys);
  if (!ok) {
    onFailure("[notify] failed to persist fired keys");
  }
}

export async function claimDueForAnnounce(
  due: readonly DueReminder[],
): Promise<{ firedKeys: Set<string>; toAnnounce: DueReminder[] }> {
  const claimedKeys = await claimFiredKeys(due.map((item) => item.dedupeKey));
  const firedKeys = loadFiredKeys();
  return {
    firedKeys,
    toAnnounce: due.filter((item) => claimedKeys.has(item.dedupeKey)),
  };
}
